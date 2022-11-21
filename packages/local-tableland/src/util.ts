import { isAbsolute, join, resolve } from "node:path";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { ChildProcess, SpawnSyncReturns } from "node:child_process";
import { getDefaultProvider, Wallet } from "ethers";
import { connect, Connection } from "@tableland/sdk";
import { chalk } from "./chalk.js";

// NOTE: We are creating this file in the prebuild.sh script so that we can support cjs and esm
import { getDirname } from "./get-dirname.js";
const _dirname = getDirname();

export type ConfigDescriptor = {
  name: string;
  env: "VALIDATOR_DIR" | "REGISTRY_DIR" | "VERBOSE" | "SILENT";
  file: "validatorDir" | "registryDir" | "verbose" | "silent";
  arg: "validator" | "registry" | "verbose" | "silent";
  isPath: boolean;
};

// build a config object from
//       1. env vars
//       2. command line args, e.g. `npx local-tableland --validator ../go-tableland`
//       3. a `tableland.config.js` file, which is either inside `process.pwd()` or specified
//          via command line arg.  e.g. `npx local-tableland --config ../tlb-confib.js`
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
];

export type Config = {
  validator?: string;
  validatorDir?: string;
  registry?: string;
  registryDir?: string;
  verbose?: boolean;
  silent?: boolean;
};

export const buildConfig = function (config: Config) {
  const configObject: { [x: string]: string | boolean | undefined } = {};
  for (let i = 0; i < configDescriptors.length; i++) {
    const configDescriptor = configDescriptors[i];

    const file = config[configDescriptor.file];
    const arg = config[configDescriptor.arg];
    const env = process.env[configDescriptor.env];

    let val: string | boolean | undefined;
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
      // if not verbose we are going to elliminate multiple empty
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

export const getConnection = function (account: Wallet): Connection {
  return connect({ signer: account, chain: "local-tableland" });
};

export const getAccounts = function (): Wallet[] {
  // explicitly use IPv4 127.0.0.1
  // node resolves localhost to IPv4 or IPv6 depending on env
  return hardhatAccounts.map((account) => {
    const wallet = new Wallet(account);
    return wallet.connect(getDefaultProvider("http://127.0.0.1:8545"));
  });
};
