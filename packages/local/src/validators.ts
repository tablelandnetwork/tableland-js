import { type ChildProcess } from "node:child_process";
import { join, resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import spawn from "cross-spawn";
import { getBinPath } from "@tableland/validator";
import shell from "shelljs";
import { logSync, isWindows } from "./util.js";

// NOTE: We are creating this file in the fixup.sh script so that we can support cjs and esm
import { getDirname } from "./get-dirname.js";
const _dirname = getDirname();

const spawnSync = spawn.sync;

// TODO: should this be a per instance value?
// store the Validator config file in memory, so we can restore it during cleanup
let ORIGINAL_VALIDATOR_CONFIG: string | undefined;

class ValidatorPkg {
  readonly defaultRegistryPort: number = 8545;

  process?: ChildProcess;
  validatorDir = "";
  validatorCleanDir = resolve(_dirname, "..", "..", "validator", "clean");
  validatorForkDir = resolve(_dirname, "..", "..", "validator", "fork");
  registryPort: number;

  constructor(validatorDir?: string, registryPort?: number) {
    if (typeof validatorDir === "string") {
      this.validatorDir = validatorDir;
    }
    if (typeof registryPort === "number") {
      // Port sanitization happens in the parent Local Tableland process
      this.registryPort = registryPort;
    } else {
      this.registryPort = this.defaultRegistryPort;
    }
  }

  start(registryAddress?: string, shouldFork?: boolean): void {
    const binPath = getBinPath();
    if (binPath == null) {
      throw new Error(
        `cannot start with: arch ${process.arch}, platform ${process.platform}`
      );
    }
    this.validatorDir = shouldFork
      ? this.validatorForkDir
      : this.validatorCleanDir;

    // TODO: we need to set the registry address based on the fork, and what chain has been forked

    // Get the path to the directory holding the validator config we want to use.
    // Windows looks like C:\Users\tester\Workspaces\test-loc\node_modules\@tableland\local\validator
    // unix looks like      /Users/tester/Workspaces/test-loc/node_modules/@tableland/local/validator
    // We have to convert the windows path to a valid URI so that the validator can
    // use it to create a sqlite connection string, basically make windows act like unix.
    let validatorUri = "";
    if (isWindows()) {
      // remove the C:
      if (this.validatorDir.indexOf("C:") === 0) {
        validatorUri = this.validatorDir.slice(2);
      }
      validatorUri = validatorUri.replace("\\", "/");
    } else {
      validatorUri = this.validatorDir;
    }

    // get the validator config file
    const configFilePath = join(this.validatorDir, "config.json");
    const configFileStr = readFileSync(configFilePath).toString();
    const validatorConfig = JSON.parse(configFileStr);

    // save the validator config state
    ORIGINAL_VALIDATOR_CONFIG = configFileStr;

    // make sure the value in the config file matches the port we are using
    // if not, update the validator config file with a new `EthEndpoint` port
    if (
      validatorConfig.Chains[0].Registry.EthEndpoint !==
      `ws://localhost:${this.registryPort}`
    ) {
      validatorConfig.Chains[0].Registry.EthEndpoint = `ws://localhost:${this.registryPort}`;
      writeFileSync(configFilePath, JSON.stringify(validatorConfig, null, 2));
    }
    if (typeof registryAddress === "string" && registryAddress.trim() !== "") {
      validatorConfig.Chains[0].Registry.ContractAddress =
        registryAddress.trim();
    }

    // start the validator
    this.process = spawn(binPath, ["--dir", validatorUri], {
      // we can't run in windows if we use detached mode
      detached: !isWindows(),
    });
  }

  shutdown(): void {
    if (this.process == null) throw new Error("Cannot find validator process");
    // If this Class is imported and run by a test runner then the ChildProcess instances are
    // sub-processes of a ChildProcess instance which means in order to kill them in a way that
    // enables graceful shut down they have to run in detached mode and be killed by the pid
    try {
      // @ts-expect-error pid is possibly undefined, which is fine
      process.kill(-this.process.pid);
    } catch (err: any) {
      // It's possible that a pid will exist, but the process is terminated
      // e.g., try running two Local Tableland instances at the same time. If
      // this happens, `cleanup` never gets called (e.g., files not reset).
      if (err.code === "ESRCH") {
        throw new Error(`validator process already killed`);
      } else {
        throw err;
      }
    }
  }

  // fully nuke the database and reset the config file
  cleanup(): void {
    shell.rm("-rf", resolve(this.validatorDir, "backups"));

    const dbFiles = [
      resolve(this.validatorDir, "database.db"),
      resolve(this.validatorDir, "metrics.db"),
    ];
    for (const filepath of dbFiles) {
      shell.rm("-f", filepath);
    }

    // reset the Validator config file in case it was modified with a custom
    // Registry hardhat port
    if (ORIGINAL_VALIDATOR_CONFIG != null) {
      const configFilePath = join(this.validatorDir, "config.json");
      writeFileSync(configFilePath, ORIGINAL_VALIDATOR_CONFIG);
    }
  }
}

class ValidatorDev {
  validatorDir: string;
  process?: ChildProcess;
  registryPort: number;
  readonly defaultRegistryPort: number = 8545;

  constructor(validatorDir?: string, registryPort?: number) {
    if (validatorDir == null) throw new Error("must supply path to validator");
    this.validatorDir = validatorDir;
    if (typeof registryPort === "number") {
      // Port sanitization happens in the parent Local Tableland process
      this.registryPort = registryPort;
    } else {
      this.registryPort = this.defaultRegistryPort;
    }
  }

  start(registryAddress?: string): void {
    if (typeof registryAddress !== "string") {
      throw new Error("must provide registry address");
    }
    // Add the registry address to the Validator config
    // TODO: when https://github.com/tablelandnetwork/go-tableland/issues/317 is
    //       resolved we may be able to refactor a lot of this
    const configFilePath = join(
      this.validatorDir,
      "docker",
      "local",
      "api",
      "config.json"
    );
    const configFileStr = readFileSync(configFilePath).toString();
    const validatorConfig = JSON.parse(configFileStr);

    // save the validator config state before this script modifies it
    ORIGINAL_VALIDATOR_CONFIG = configFileStr;

    // make sure the value in the config file matches the port we are using
    // if not, update the validator config file with a new `EthEndpoint` port
    if (
      validatorConfig.Chains[0].Registry.EthEndpoint !==
      `ws://localhost:${this.registryPort}`
    ) {
      validatorConfig.Chains[0].Registry.EthEndpoint = `ws://localhost:${this.registryPort}`;
    }

    validatorConfig.Chains[0].Registry.ContractAddress = registryAddress;

    writeFileSync(configFilePath, JSON.stringify(validatorConfig, null, 2));

    // start the validator
    this.process = spawn("make", ["local-up"], {
      // we can't run in windows if we use detached mode
      detached: !isWindows(),
      cwd: join(this.validatorDir, "docker"),
    });
  }

  shutdown(): void {
    // The validator uses make to shutdown when run via docker
    spawnSync("make", ["local-down"], {
      cwd: join(this.validatorDir, "docker"),
    });
    // If this Class is imported and run by a test runner then the ChildProcess instances are
    // sub-processes of a ChildProcess instance which means in order to kill them in a way that
    // enables graceful shut down they have to run in detached mode and be killed by the pid
    try {
      // @ts-expect-error pid is possibly undefined, which is fine
      process.kill(-this.process.pid);
    } catch (err: any) {
      // It's possible that a pid will exist, but the process is terminated
      // e.g., try running two Local Tableland instances at the same time. If
      // this happens, `cleanup` never gets called (e.g., files not reset).
      if (err.code === "ESRCH") {
        throw new Error(`validator process already killed`);
      } else {
        throw err;
      }
    }
  }

  cleanup(): void {
    logSync(spawnSync("docker", ["container", "prune", "-f"]));

    spawnSync("docker", ["image", "rm", "docker-api", "-f"]);
    spawnSync("docker", ["volume", "prune", "-f"]);

    const dbFiles = [
      join(this.validatorDir, "docker", "local", "api", "database.db"),
      join(this.validatorDir, "docker", "local", "api", "database.db-shm"),
      join(this.validatorDir, "docker", "local", "api", "database.db-wal"),
    ];

    for (const filepath of dbFiles) {
      spawnSync("rm", ["-f", filepath]);
    }

    // reset the Validator config file that is modified on startup and/or custom
    // Registry port configurations
    if (ORIGINAL_VALIDATOR_CONFIG != null) {
      const configFilePath = join(
        this.validatorDir,
        "docker",
        "local",
        "api",
        "config.json"
      );
      writeFileSync(configFilePath, ORIGINAL_VALIDATOR_CONFIG);
    }
  }
}

export { ValidatorDev, ValidatorPkg };
