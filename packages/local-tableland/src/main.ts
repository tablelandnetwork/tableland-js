/**
 *  Run end to end Tableland
 **/

import { spawn, spawnSync, ChildProcess } from "node:child_process";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { readFileSync, writeFileSync } from "node:fs";
import { chalk } from "./chalk.js";
import {
  buildConfig,
  defaultRegistryDir,
  getConfigFile,
  Config,
  pipeNamedSubprocess,
  waitForReady,
  getAccounts,
  logSync,
} from "./util.js";

// TODO: should this be a per instance value?
// store the Validator config file in memory, so we can restore it during cleanup
let ORIGINAL_VALIDATOR_CONFIG: string | undefined;

class LocalTableland {
  config;
  initEmitter;
  registry?: ChildProcess;
  validator?: ChildProcess;

  validatorDir?: string;
  registryDir?: string;
  verbose?: boolean;
  silent?: boolean;

  constructor(configParams: Config = {}) {
    this.config = configParams;

    // an emitter to help with init logic across the multiple sub-processes
    this.initEmitter = new EventEmitter();
  }

  async start() {
    const configFile = await getConfigFile();
    const config = buildConfig({ ...configFile, ...this.config });

    if (typeof config.validatorDir === "string")
      this.validatorDir = config.validatorDir;
    if (typeof config.registryDir === "string" && config.registryDir) {
      this.registryDir = config.registryDir;
    } else {
      this.registryDir = defaultRegistryDir();
    }
    if (typeof config.verbose === "boolean") this.verbose = config.verbose;
    if (typeof config.silent === "boolean") this.silent = config.silent;

    await this.#_start();
  }

  async #_start() {
    if (!(this.validatorDir && this.registryDir)) {
      throw new Error(
        "cannot start a local network without Validator and Registry"
      );
    }

    // make sure we are starting fresh
    this.#_cleanup();

    // Run a local hardhat node
    this.registry = spawn("npx", ["hardhat", "node"], {
      detached: true,
      cwd: this.registryDir,
    });

    this.registry.on("error", (err) => {
      throw new Error(`registry errored with: ${err}`);
    });

    const registryReadyEvent = "hardhat ready";
    // this process should keep running until we kill it
    pipeNamedSubprocess(chalk.cyan.bold("Registry"), this.registry, {
      // use events to indicate when the underlying process is finished
      // initializing and is ready to participate in the Tableland network
      readyEvent: registryReadyEvent,
      emitter: this.initEmitter,
      message: "Mined empty block",
      verbose: this.verbose,
      silent: this.silent,
    });

    // wait until initialization is done
    await waitForReady(registryReadyEvent, this.initEmitter);

    // Deploy the Registry to the Hardhat node
    logSync(
      spawnSync(
        "npx",
        ["hardhat", "run", "--network", "localhost", "scripts/deploy.ts"],
        {
          cwd: this.registryDir,
        }
      )
    );

    // Add an empty .env file to the validator. The Validator expects this to exist,
    // but doesn't need any of the values when running a local instance
    writeFileSync(
      join(this.validatorDir, "/docker/local/api/.env_validator"),
      " "
    );

    // Add the registry address to the Validator config
    const configFilePath = join(
      this.validatorDir,
      "/docker/local/api/config.json"
    );
    const configFileStr = readFileSync(configFilePath).toString();
    const validatorConfig = JSON.parse(configFileStr);

    // save the validator config state before this script modifies it
    ORIGINAL_VALIDATOR_CONFIG = JSON.stringify(validatorConfig, null, 2);

    // TODO: this could be parsed out of the deploy process, but since
    //       it's always the same address just hardcoding it here
    validatorConfig.Chains[0].Registry.ContractAddress =
      "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";

    writeFileSync(configFilePath, JSON.stringify(validatorConfig, null, 2));

    // start the validator
    this.validator = spawn("make", ["local-up"], {
      detached: true,
      cwd: join(this.validatorDir, "docker"),
    });

    this.validator.on("error", (err) => {
      throw new Error(`validator errored with: ${err}`);
    });

    const validatorReadyEvent = "validator ready";
    // this process should keep running until we kill it
    pipeNamedSubprocess(chalk.yellow.bold("Validator"), this.validator, {
      // use events to indicate when the underlying process is finished
      // initializing and is ready to participate in the Tableland network
      readyEvent: validatorReadyEvent,
      emitter: this.initEmitter,
      message: "processing height",
      verbose: this.verbose,
      silent: this.silent,
      fails: {
        message: "Cannot connect to the Docker daemon",
        hint: "Looks like we cannot connect to Docker.  Do you have the Docker running?",
      },
    });

    // wait until initialization is done
    await waitForReady(validatorReadyEvent, this.initEmitter);

    if (this.silent) return;

    console.log("\n\n******  Tableland is running!  ******");
    console.log("             _________");
    console.log("         ___/         \\");
    console.log("        /              \\");
    console.log("       /                \\");
    console.log("______/                  \\______\n\n");
  }

  async shutdown() {
    await this.shutdownValidator();
    await this.shutdownRegistry();
    this.#_cleanup();
  }

  shutdownRegistry(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.registry) return resolve();

      this.registry.once("close", () => resolve());
      // If this Class is imported and run by a test runner then the ChildProcess instances are
      // sub-processes of a ChildProcess instance which means in order to kill them in a way that
      // enables graceful shut down they have to run in detached mode and be killed by the pid
      // @ts-ignore
      process.kill(-this.registry.pid);
    });
  }

  shutdownValidator(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.validator) return resolve();

      this.validator.on("close", () => resolve());
      // If this Class is imported and run by a test runner then the ChildProcess instances are
      // sub-processes of a ChildProcess instance which means in order to kill them in a way that
      // enables graceful shut down they have to run in detached mode and be killed by the pid
      // @ts-ignore
      process.kill(-this.validator.pid);
    });
  }

  // cleanup should restore everything to the starting state.
  // e.g. remove docker images and database backups
  #_cleanup() {
    logSync(spawnSync("docker", ["container", "prune", "-f"]));

    spawnSync("docker", ["image", "rm", "docker_api", "-f"]);
    spawnSync("docker", ["volume", "prune", "-f"]);
    spawnSync("rm", ["-rf", "./tmp"]);

    // If the directory hasn't been specified there isn't anything to clean up
    if (!this.validatorDir) return;

    const dbFiles = [
      join(this.validatorDir, "/docker/local/api/database.db"),
      join(this.validatorDir, "/docker/local/api/database.db-shm"),
      join(this.validatorDir, "/docker/local/api/database.db-wal"),
    ];

    for (const filepath of dbFiles) {
      spawnSync("rm", ["-f", filepath]);
    }

    // reset the Validator config file that is modified on startup
    if (ORIGINAL_VALIDATOR_CONFIG) {
      const configFilePath = join(
        this.validatorDir,
        "/docker/local/api/config.json"
      );
      writeFileSync(configFilePath, ORIGINAL_VALIDATOR_CONFIG);
    }
  }
}

export { LocalTableland, getAccounts };
