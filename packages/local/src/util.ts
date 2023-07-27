import { Socket } from "net";
import inspector from "node:inspector";
import { isAbsolute, join, resolve } from "node:path";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { ChildProcess, SpawnSyncReturns } from "node:child_process";
import { getDefaultProvider, Wallet } from "ethers";
import { helpers, Database, Registry, Validator } from "@tableland/sdk";
import { chalk } from "./chalk.js";
import { type LocalTableland } from "./main.js";

// NOTE: We are creating this file in the fixup.sh script so that we can support cjs and esm
import { getDirname } from "./get-dirname.js";
const _dirname = getDirname();

const getBaseUrl = helpers.getBaseUrl;
const overrideDefaults = helpers.overrideDefaults;
const getChainId = helpers.getChainId;

// The SDK does not know about the local-tableland contract
overrideDefaults(getChainId("local-tableland"), {
  contractAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
});

export type ConfigDescriptor = {
  name: string;
  env:
    | "VALIDATOR_DIR"
    | "REGISTRY_DIR"
    | "VERBOSE"
    | "SILENT"
    | "DOCKER"
    | "REGISTRY_PORT";
  file:
    | "validatorDir"
    | "registryDir"
    | "verbose"
    | "silent"
    | "docker"
    | "registryPort";
  arg:
    | "validator"
    | "registry"
    | "verbose"
    | "silent"
    | "docker"
    | "registryPort";
  isPath: boolean;
};

// build a config object from
//       1. env vars
//       2. command line args, e.g. `npx local-tableland --validator ../go-tableland`
//       3. a `tableland.config.js` file, which is either inside `process.pwd()` or specified
//          via command line arg.  e.g. `npx local-tableland --config ../tbl-config.js`
const configDescriptors: ConfigDescriptor[] = [
  {
    name: "validatorDir",
    env: "VALIDATOR_DIR",
    file: "validatorDir",
    arg: "validator",
    isPath: true,
  },
  {
    name: "registryDir",
    env: "REGISTRY_DIR",
    file: "registryDir",
    arg: "registry",
    isPath: true,
  },
  {
    name: "docker",
    env: "DOCKER",
    file: "docker",
    arg: "docker",
    isPath: false,
  },
  {
    name: "verbose",
    env: "VERBOSE",
    file: "verbose",
    arg: "verbose",
    isPath: false,
  },
  {
    name: "silent",
    env: "SILENT",
    file: "silent",
    arg: "silent",
    isPath: false,
  },
  {
    name: "registryPort",
    env: "REGISTRY_PORT",
    file: "registryPort",
    arg: "registryPort",
    isPath: false,
  },
];

/**
 * Configuration object for a Local Tableland instance.
 */
export type Config = {
  /**
   * Instance of a Tableland Validator. If docker flag is set, this must be the
   * full repository.
   */
  validator?: string;
  /**
   * IPath to the Tableland Validator directory.
   */
  validatorDir?: string;
  /**
   * Instance of a Tableland Registry.
   */
  registry?: string;
  /**
   * Instance of a Tableland Registry.
   */
  registryDir?: string;
  /**
   * Path to the Tableland Registry contract repository.
   */
  docker?: boolean;
  /**
   * Use Docker to run the Validator.
   */
  verbose?: boolean;
  /**
   * Silence all output to stdout.
   */
  silent?: boolean;
  /**
   * Use a custom Registry hardhat port, e.g., `http://127.0.0.1:<registryPort>`.
   * Note that clients will need to be configured to use this port over the
   * default port, e.g., connect to `http://127.0.0.1:<registryPort>`
   * instead of `http://127.0.0.1:8545`.
   */
  registryPort?: number;
};

export const buildConfig = function (config: Config) {
  const configObject: { [x: string]: string | number | boolean | undefined } =
    {};
  for (let i = 0; i < configDescriptors.length; i++) {
    const configDescriptor = configDescriptors[i];

    const file = config[configDescriptor.file];
    const arg = config[configDescriptor.arg];
    const env = process.env[configDescriptor.env];

    let val: string | number | boolean | undefined;
    // priority is: command argument, then environment variable, then config file
    val = arg || env || file;

    if (
      configDescriptor.isPath &&
      typeof val === "string" &&
      val &&
      !isAbsolute(val)
    ) {
      // if path is not absolute treat it as if it's relative
      // to calling cwd and build the absolute path
      val = resolve(process.cwd(), val);
    }

    configObject[configDescriptor.name] = val;
  }

  return configObject;
};

export const getConfigFile = async function () {
  try {
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    const { default: confFile } = await import(
      join(process.cwd(), "tableland.config.js")
    );
    return confFile;
  } catch (err) {
    // can't find and import tableland config file
    return {};
  }
};

const isExtraneousLog = function (log: string) {
  log = log.toLowerCase();

  if (log.match(/eth_getLogs/i)) return true;
  if (log.match(/Mined empty block/i)) return true;
  if (log.match(/eth_getBlockByNumber/i)) return true;
  if (log.match(/eth_getBalance/i)) return true;
  if (log.match(/processing height/i)) return true;
  if (log.match(/new last processed height/i)) return true;
  if (log.match(/eth_unsubscribe/i)) return true;
  if (log.match(/eth_subscribe/i)) return true;
  if (log.match(/new blocks subscription is quiet, rebuilding/i)) return true;
  if (log.match(/received new chain header/i)) return true;
  if (log.match(/dropping new height/i)) return true;

  return false;
};

export const isWindows = function () {
  return process.platform === "win32";
};

export const inDebugMode = function () {
  // This seems to be the only reliable way to determine if the process
  // is being debugged either at startup, or during runtime (e.g. vscode)
  return inspector.url() !== undefined;
};

/**
 * Check if a port is in the valid range (1-65535).
 * @param port The port number.
 * @returns Whether or not the port is valid.
 */
export const isValidPort = function (port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
};

export const logSync = function (
  prcss: SpawnSyncReturns<Buffer>,
  shouldThrow = true
) {
  // make sure this blows up if Docker isn't running
  const psError = prcss.stderr && prcss.stderr.toString();
  if (shouldThrow && psError) {
    console.log(chalk.red(psError));
    throw psError;
  }
};

export interface PipeOptions {
  message?: string;
  fails?: {
    message: string;
    hint: string;
  };
  verbose?: boolean;
  silent?: boolean;
  emitter?: EventEmitter;
  readyEvent?: string;
}

export const pipeNamedSubprocess = async function (
  prefix: string,
  prcss: ChildProcess,
  options?: PipeOptions
) {
  let ready = !(options && options.message);
  const fails = options?.fails;
  const verbose = options?.verbose;
  const silent = options?.silent;

  if (!(prcss.stdout instanceof Readable && prcss.stderr instanceof Readable)) {
    throw new Error("cannot pipe subprocess with out stdout and stderr");
  }

  prcss.stdout.on("data", function (data: string) {
    // data is going to be a buffer at runtime
    data = data.toString();
    if (!data) return;

    let lines = data.split("\n");
    if (!verbose) {
      lines = lines.filter((line) => !isExtraneousLog(line));
      // if not verbose we are going to eliminate multiple empty
      // lines and any messages that don't have at least one character
      if (!lines.filter((line) => line.trim()).length) {
        lines = [];
      } else {
        lines = lines.reduce((acc, cur) => {
          if (acc.length && !acc[acc.length - 1] && !cur.trim()) return acc;

          // @ts-ignore
          return acc.concat([cur.trim()]);
        }, []);
      }
    }

    if (!silent) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!verbose && isExtraneousLog(line)) continue;
        console.log(`[${prefix}] ${line}`);
      }
    }

    if (!ready) {
      if (
        options &&
        typeof options.message === "string" &&
        data.includes(options.message) &&
        typeof options.readyEvent === "string" &&
        options.emitter instanceof EventEmitter
      ) {
        options.emitter.emit(options.readyEvent);
        ready = true;
      }
    }
  });

  prcss.stderr.on("data", function (data: string) {
    if (!(data && data.toString)) return;
    // data is going to be a buffer at runtime
    data = data.toString();
    if (!data.trim()) return;

    const lines = data
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      console.error(`[${prefix}] ${line}`);
    }
    if (fails && data.includes(fails.message)) {
      throw new Error(fails.message);
    }
  });
};

// enable async/await for underlying event pattern
export const waitForReady = function (
  readyEvent: string,
  emitter: EventEmitter
): Promise<void> {
  return new Promise(function (resolve) {
    emitter.once(readyEvent, () => resolve());
  });
};

export const defaultRegistryDir = async function () {
  return resolve(_dirname, "..", "..", "registry");
};

/**
 * Set up a socket connection to check if a port is in use.
 * @param port The port number.
 * @returns true if the port is in use, false otherwise.
 */
export function checkPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const timeout = 200;
    const host = "127.0.0.1";
    const socket = new Socket();

    // Socket connection established, so port is in use
    const onConnect = () => {
      cleanup();
      resolve(true);
    };

    // If no response on timeout, assume port is in use
    const onTimeout = () => {
      cleanup();
      resolve(true);
    };

    // If connection is refused, the port is open
    const onError = (err: Error & { code: string }) => {
      cleanup();
      if (err.code === "ECONNREFUSED") {
        resolve(false);
      } else {
        reject(err);
      }
    };

    // Attach event listeners
    socket.once("connect", onConnect);
    socket.once("timeout", onTimeout);
    socket.once("error", onError);

    // Clean up event listeners
    const cleanup = () => {
      socket.off("connect", onConnect);
      socket.off("timeout", onTimeout);
      socket.off("error", onError);
      socket.destroy();
    };

    // Set timeout and connect to the port
    socket.setTimeout(timeout);
    socket.connect(port, host);
  });
}

/**
 * Probe a port with retries to check if it is in use.
 * @param port The port number.
 * @param tries Number of retries to attempt. Defaults to 5.
 * @param delay Time to wait between retries (in milliseconds). Defaults to 300.
 * @returns true if the port is in use, false otherwise
 */
export async function probePortInUse(
  port: number,
  tries: number = 5,
  delay: number = 300
): Promise<boolean> {
  let numTries = 0;
  while (numTries < tries) {
    // Note: consider splitting the delay into before and after this check
    // Racing two instances might cause this to incorrectly return `false`
    const portIsTaken = await checkPortInUse(port);
    if (!portIsTaken) return false;

    await new Promise((resolve) => setTimeout(resolve, delay));
    numTries++;
  }
  return true;
}

const hardhatAccounts = [
  "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "dbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
  "2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
  "f214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897",
  "701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82",
  "a267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1",
  "47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd",
  "c526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa",
  "8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61",
  "ea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0",
  "689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd",
  "de9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0",
  "df57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e",
];

/**
 * Get an instance of a Tableland `Database` for a signer.
 * @param account The account to use for signing transactions.
 * @returns An instance of a Tableland `Database` with the account as the
 * signer, base URL, and auto-await enabled.
 */
export const getDatabase = function (account: Wallet): Database {
  return new Database({
    signer: account,
    baseUrl: getBaseUrl("local-tableland"),
    autoWait: true,
  });
};

/**
 * Get an instance of a Tableland `Registry` for a signer.
 * @param account The account to use for signing transactions.
 * @returns An instance of a Tableland `Registry` with the account as the
 * signer.
 */
export const getRegistry = function (account: Wallet): Registry {
  return new Registry({
    signer: account,
  });
};

/**
 * Get an instance of a Tableland `Validator`.
 * @param baseUrl The validator's base URL to perform queries at.
 * @returns An instance of a Tableland `Validator` with the correct `baseUrl`
 */
export const getValidator = function (baseUrl?: string): Validator {
  return new Validator({
    baseUrl: baseUrl || getBaseUrl("local-tableland"),
  });
};

/**
 * Get all of the connected accounts available for signing transactions.
 * Defaults to RPC URL `http://127.0.0.1:8545` if no instance is provided.
 * @param instance An instance of Local Tableland.
 * @returns An instance of a Tableland `Validator` with the correct `baseUrl`.
 */
export const getAccounts = function (instance?: LocalTableland): Wallet[] {
  // explicitly use IPv4 127.0.0.1
  // node resolves localhost to IPv4 or IPv6 depending on env
  return hardhatAccounts.map((account) => {
    const wallet = new Wallet(account);
    const port = instance ? getRegistryPort(instance) : 8545;
    return wallet.connect(getDefaultProvider(`http://127.0.0.1:${port}`));
  });
};

/**
 * Retrieve the port being used by the Registry on a local hardhat network.
 * Defaults to port 8545 if no instance is provided.
 * @param instance An instance of Local Tableland.
 * @returns The port number being used by the Registry.
 */
export const getRegistryPort = (instance?: LocalTableland): number => {
  return instance ? instance.registryPort : 8545;
};
