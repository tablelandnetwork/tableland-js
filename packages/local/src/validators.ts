import spawn from "cross-spawn";
import { ChildProcess } from "node:child_process";
import { join, resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { getBinPath } from "@tableland/validator";
import shell from "shelljs";
import { logSync, isWindows } from "./util.js";

// NOTE: We are creating this file in the prebuild.sh script so that we can support cjs and esm
import { getDirname } from "./get-dirname.js";
const _dirname = getDirname();

const spawnSync = spawn.sync;

// TODO: should this be a per instance value?
// store the Validator config file in memory, so we can restore it during cleanup
let ORIGINAL_VALIDATOR_CONFIG: string | undefined;

class ValidatorPkg {
  process?: ChildProcess;
  validatorDir = resolve(_dirname, "..", "..", "validator");

  constructor(validatorDir?: string) {
    if (typeof validatorDir === "string") {
      this.validatorDir = validatorDir;
    }
  }

  start() {
    const binPath = getBinPath();
    if (!binPath) {
      throw new Error(
        `cannot start with: arch ${process.arch}, platform ${process.platform}`
      );
    }

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

    this.process = spawn(binPath, ["--dir", validatorUri], {
      // we can't run in windows if we use detached mode
      detached: !isWindows(),
    });
  }

  shutdown() {
    if (!this.process) throw new Error("Cannot find validator process");
    // If this Class is imported and run by a test runner then the ChildProcess instances are
    // sub-processes of a ChildProcess instance which means in order to kill them in a way that
    // enables graceful shut down they have to run in detached mode and be killed by the pid
    // @ts-ignore
    process.kill(-this.process.pid);
  }

  // fully nuke the database
  cleanup() {
    shell.rm("-rf", resolve(this.validatorDir, "backups"));

    const dbFiles = [
      resolve(this.validatorDir, "database.db"),
      resolve(this.validatorDir, "metrics.db"),
    ];
    for (const filepath of dbFiles) {
      shell.rm("-f", filepath);
    }
  }
}

class ValidatorDev {
  validatorDir: string;
  process?: ChildProcess;

  constructor(validatorDir?: string) {
    if (!validatorDir) throw new Error("must supply path to validator");
    this.validatorDir = validatorDir;
  }

  start() {
    // Add the registry address to the Validator config
    // TODO: when https://github.com/tablelandnetwork/go-tableland/issues/317 is
    //       resolved we may be able to refactor alot of this
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
    ORIGINAL_VALIDATOR_CONFIG = JSON.stringify(validatorConfig, null, 2);

    // TODO: this could be parsed out of the deploy process, but since
    //       it's always the same address just hardcoding it here
    // TODO: maybe we can get this from evm-tableland?
    validatorConfig.Chains[0].Registry.ContractAddress =
      "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";

    writeFileSync(configFilePath, JSON.stringify(validatorConfig, null, 2));

    // start the validator
    this.process = spawn("make", ["local-up"], {
      // we can't run in windows if we use detached mode
      detached: !isWindows(),
      cwd: join(this.validatorDir, "docker"),
    });
  }

  shutdown() {
    // The validator uses make to shutdown when run via docker
    spawnSync("make", ["local-down"], {
      cwd: join(this.validatorDir, "docker"),
    });
    // If this Class is imported and run by a test runner then the ChildProcess instances are
    // sub-processes of a ChildProcess instance which means in order to kill them in a way that
    // enables graceful shut down they have to run in detached mode and be killed by the pid
    // @ts-ignore
    process.kill(-this.process.pid);
  }

  cleanup() {
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

    // reset the Validator config file that is modified on startup
    if (ORIGINAL_VALIDATOR_CONFIG) {
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
