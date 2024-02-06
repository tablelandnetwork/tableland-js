/**
 *  Run end to end Tableland
 **/
import { type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import spawn from "cross-spawn";
import shell from "shelljs";
import { getDefaultProvider } from "ethers";
import { helpers } from "@tableland/sdk";
import { chalk } from "./chalk.js";
import { ValidatorDev, ValidatorPkg } from "./validators.js";
import {
  buildConfig,
  type Config,
  checkPortInUse,
  defaultRegistryDir,
  inDebugMode,
  isValidPort,
  isWindows,
  getAccounts,
  getConfigFile,
  getDatabase,
  getRegistry,
  getRegistryPort,
  getValidator,
  logSync,
  pipeNamedSubprocess,
  waitForReady,
} from "./util.js";

const spawnSync = spawn.sync;

class LocalTableland {
  readonly defaultRegistryPort: number = 8545;

  #_readyResolves: Array<(value: unknown) => any> = [];
  config;
  initEmitter;
  ready: boolean = false;
  // default registry address when deployed to clean hardhat chain
  registryAddress: string = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
  registry?: ChildProcess;
  validator?: ValidatorDev | ValidatorPkg;
  validatorDir?: string;
  registryDir?: string;
  docker?: boolean;
  verbose?: boolean;
  silent?: boolean;
  registryPort: number;

  constructor(configParams: Config = {}) {
    this.config = configParams;
    this.registryPort = this.defaultRegistryPort;

    // an emitter to help with init logic across the multiple sub-processes
    this.initEmitter = new EventEmitter();
  }

  async start(): Promise<void> {
    const configFile = await getConfigFile();
    const config = buildConfig({ ...configFile, ...this.config });

    if (typeof config.validatorDir === "string")
      this.validatorDir = config.validatorDir;
    if (
      typeof config.registryDir === "string" &&
      config.registryDir.trim() !== ""
    ) {
      this.registryDir = config.registryDir.trim();
    } else {
      this.registryDir = defaultRegistryDir();
    }
    if (typeof config.docker === "boolean") this.docker = config.docker;
    if (typeof config.verbose === "boolean") this.verbose = config.verbose;
    if (typeof config.silent === "boolean") this.silent = config.silent;
    if (typeof config.registryPort === "number") {
      // Make sure the port is in the valid range
      if (!isValidPort(config.registryPort))
        throw new Error("invalid Registry port");
      this.registryPort = config.registryPort;
    }

    await this.#_start(config);
  }

  async #_start(config: Config = {}): Promise<void> {
    if (typeof this.registryDir !== "string" || this.registryDir === "") {
      throw new Error("cannot start a local network without Registry");
    }

    // make sure we are starting fresh
    this.#_cleanup();

    // Check if the hardhat port is in use (defaults to 5 retries, 300ms b/w each try)
    const registryPortIsTaken = await checkPortInUse(this.registryPort);
    // Note: this generally works, but there is a chance that the port will be
    // taken but returns `false`. E.g., try racing two instances at *exactly*
    // the same, and `EADDRINUSE` occurs. But generally, it'll work as expected.

    // If the Registry port it taken, throw an error.
    // Else, notify the user only if it's a not the default and is custom.
    if (registryPortIsTaken) {
      throw new Error(`port ${this.registryPort} already in use`);
    }

    // Notify that we're using a custom port since it's not the default 8545
    if (
      this.registryPort !== this.defaultRegistryPort &&
      this.silent !== true
    ) {
      shell.echo(
        `[${chalk.magenta.bold("Notice")}] Registry is using custom port ${
          this.registryPort
        }`
      );
    }

    // You *must* store these in `process.env` to access within the hardhat subprocess
    process.env.HARDHAT_NETWORK = "hardhat";
    process.env.HARDHAT_UNLIMITED_CONTRACT_SIZE = "true";
    process.env.HARDHAT_PORT = this.registryPort.toString();

    // There's two ways of signaling a fork should be used. The `FORK_URL`
    // env var, or the config has a fork property.  Either way this means we
    // don't need to deploy the registry, and the validator should listen to
    // a different contract address, specifically the mainnet address.
    const shouldFork = !!config.forkUrl;
    const forkChainId = this._getForkChainId(config);

    const hardhatCommandArr = [
      "hardhat",
      "node",
      "--port",
      this.registryPort.toString(),
    ];
    // eslint-disable-next-line
    const registryEnv = {
      ...process.env,
      HARDHAT_NETWORK: "hardhat",
      HARDHAT_UNLIMITED_CONTRACT_SIZE: "true",
    } as {
      HARDHAT_NETWORK: string;
      HARDHAT_UNLIMITED_CONTRACT_SIZE: string;
      FORK_URL: string | undefined;
      FORK_BLOCK_NUMBER: string | undefined;
      FORK_CHAIN_ID: string | undefined;
      TZ?: string | undefined;
    };

    if (config.forkUrl) {
      // default fork chain is mainnet
      const chainInfo = helpers.getChainInfo(forkChainId);
      this.registryAddress = chainInfo.contractAddress;

      hardhatCommandArr.push("--fork");
      hardhatCommandArr.push(config.forkUrl);
      registryEnv.FORK_URL = config.forkUrl;
      registryEnv.FORK_CHAIN_ID = forkChainId.toString();
      if (config.forkBlockNumber) {
        hardhatCommandArr.push("--fork-block-number");
        hardhatCommandArr.push(config.forkBlockNumber);
        registryEnv.FORK_BLOCK_NUMBER = config.forkBlockNumber;
      }
    }

    // Run a local hardhat node
    this.registry = spawn(isWindows() ? "npx.cmd" : "npx", hardhatCommandArr, {
      // we can't run in windows if we use detached mode
      detached: !isWindows(),
      cwd: this.registryDir,
      env: registryEnv,
    });

    this.registry.on("error", (err) => {
      throw new Error(`registry errored with: ${err.toString()}`);
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

    await new Promise((resolve) => setTimeout(resolve, 5000));
    if (!shouldFork) {
      this._deployRegistry();

      const deployed = await this.#_ensureRegistry();
      if (!deployed) {
        throw new Error(
          "deploying registry contract failed, cannot start network"
        );
      }
    }

    await this.#_startValidator(
      shouldFork,
      shouldFork ? forkChainId : undefined
    );
    await this.#_setReady();

    if (this.silent as boolean) return;

    console.log("\n\n******  Tableland is running!  ******");
    console.log("             _________");
    console.log("         ___/         \\");
    console.log("        /              \\");
    console.log("       /                \\");
    console.log("______/                  \\______\n\n");
    console.log("Using Configuration:\n" + JSON.stringify(config, null, 4));
    console.log("\n\n*************************************\n");
  }

  private _getForkChainId(config: Config): number {
    const rawChainId = process.env.FORK_CHAIN_ID ?? config.forkChainId;
    if (typeof rawChainId !== "string" && typeof rawChainId !== "number") {
      return 1;
    }
    const chainId = parseInt(rawChainId, 10);
    return typeof chainId !== "number" || isNaN(chainId) ? 1 : chainId;
  }

  // note: Tests are using sinon to stub this method. Because typescript compiles ecmascript
  //       private features, i.e. hash syntax, in a way that does not work with sinon we must
  //       use the ts private modifier here in order to test the failure to deploy the registry.
  private _deployRegistry(): void {
    // Deploy the Registry to the Hardhat node
    logSync(
      spawnSync(
        isWindows() ? "npx.cmd" : "npx",
        ["hardhat", "run", "--network", "localhost", "scripts/deploy.ts"],
        {
          cwd: this.registryDir,
        }
      ),
      !inDebugMode()
    );
  }

  async #_ensureRegistry(): Promise<boolean> {
    const provider = getDefaultProvider(
      `http://127.0.0.1:${this.registryPort}`
    );
    const code = await provider.getCode(this.registryAddress);

    // if the contract exists, and is not empty, code will not be equal to 0x
    return code !== "0x";
  }

  async #_startValidator(
    shouldFork?: boolean,
    chainId?: number
  ): Promise<void> {
    // Need to determine if we are starting the validator via docker
    // and a local repo, or if are running a binary etc...
    const ValidatorClass = (this.docker as boolean)
      ? ValidatorDev
      : ValidatorPkg;

    this.validator = new ValidatorClass(this.validatorDir, this.registryPort);

    // run this before starting in case the last instance of the validator didn't get cleanup after
    // this might be needed if a test runner force quits the parent local-tableland process
    this.validator.cleanup();
    this.validator.start({
      chainId,
      registryAddress: this.registryAddress,
      shouldFork,
    });

    // TODO: It seems like this check isn't sufficient to see if the process is gonna get to a point
    //       where the on error listener can be attached.
    if (this.validator.process == null) {
      throw new Error("could not start Validator process");
    }

    this.validator.process.on("error", (err) => {
      throw new Error(`validator errored with: ${err.toString()}`);
    });

    const validatorReadyEvent = "validator ready";
    // this process should keep running until we kill it
    pipeNamedSubprocess(
      chalk.yellow.bold("Validator"),
      this.validator.process,
      {
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
      }
    );

    // wait until initialization is done
    await waitForReady(validatorReadyEvent, this.initEmitter);
  }

  async #_setReady(): Promise<void> {
    this.ready = true;
    while (this.#_readyResolves.length > 0) {
      // readyResolves is an array of the resolve functions for all registered
      // promises we want to pop and call each of them synchronously
      const resolve = this.#_readyResolves.pop();
      if (typeof resolve === "function") resolve(undefined);
    }
  }

  // module consumers can await this method if they want to
  // wait until the network fully started to do something
  async isReady(): Promise<unknown> {
    if (this.ready) return await Promise.resolve();

    const prom = new Promise((resolve) => {
      this.#_readyResolves.push(resolve);
    });

    return await prom;
  }

  async restartValidator(): Promise<void> {
    await this.shutdownValidator();
    await this.#_startValidator();
  }

  async shutdown(): Promise<void> {
    try {
      await this.shutdownValidator();
      await this.shutdownRegistry();
    } catch (err: any) {
      throw new Error(
        `unexpected error during shutdown: ${err.message as string}`
      );
    } finally {
      this.#_cleanup();
    }
  }

  async shutdownRegistry(): Promise<void> {
    return await new Promise((resolve) => {
      if (this.registry == null) return resolve();

      this.registry.once("close", () => resolve());
      // If this Class is imported and run by a test runner then the ChildProcess instances are
      // sub-processes of a ChildProcess instance which means in order to kill them in a way that
      // enables graceful shut down they have to run in detached mode and be killed by the pid

      // Although this shouldn't be an issue, catch an error if the registry
      // process was already killed—it *is* possible with the validator process
      // but doesn't seem to happen with the Registry
      try {
        // @ts-expect-error pid is possibly undefined, which is fine
        process.kill(-this.registry.pid);
      } catch (err: any) {
        if (err.code === "ESRCH") {
          throw new Error(`registry process already killed`);
        } else {
          throw err;
        }
      }
    });
  }

  async shutdownValidator(): Promise<void> {
    return await new Promise((resolve) => {
      if (this.validator?.process == null) {
        return resolve();
      }

      this.validator.process.on("close", () => resolve());
      this.validator.shutdown();
    });
  }

  // cleanup should restore everything to the starting state.
  // e.g. remove docker images, database backups, resetting state
  #_cleanup(): void {
    shell.rm("-rf", "./tmp");
    // If the directory hasn't been specified there isn't anything to clean up
    if (this.validator == null) return;

    this.validator.cleanup();
    // Reset validator and registry state since these are no longer needed
    this.registry = undefined;
    this.validator = undefined;
  }
}

export {
  LocalTableland,
  getAccounts,
  getDatabase,
  getRegistry,
  getRegistryPort,
  getValidator,
};
export type { Config };
