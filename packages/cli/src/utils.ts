import { readFileSync, writeFileSync, statSync } from "node:fs";
import { extname } from "path";
import { Wallet, providers, getDefaultProvider } from "ethers";
import { helpers } from "@tableland/sdk";

export const getChains = function (): typeof helpers.supportedChains {
  return Object.fromEntries(
    Object.entries(helpers.supportedChains).filter(
      ([name]) => !name.includes("staging")
    )
  ) as Record<helpers.ChainName, helpers.ChainInfo>;
};
export function getChainName(
  chain: number | helpers.ChainName
): helpers.ChainName {
  if (typeof chain === "number") {
    // convert chainId to chain name
    return helpers.getChainInfo(chain)?.chainName;
  }
  return chain;
}

export interface Options {
  privateKey: string;
  chain: number | helpers.ChainName;
  providerUrl: string | undefined;
}

export interface NormalizedStatement {
  tables: string[];
  statements: string[];
  type: string;
}

export const wait = async (timeout: number): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, timeout));

export function getLink(chain: helpers.ChainName, hash: string): string {
  /* c8 ignore start */
  if (chain.includes("ethereum")) {
    if (chain.includes("sepolia")) {
      return `https://sepolia.etherscan.io/tx/${hash}`;
    }
    return `https://etherscan.io/tx/${hash}`;
  } else if (chain.includes("polygon")) {
    if (chain.includes("mumbai")) {
      return `https://mumbai.polygonscan.com/tx/${hash}`;
    }
    return `https://polygonscan.com/tx/${hash}`;
  } else if (chain.includes("optimism")) {
    if (chain.includes("goerli")) {
      return `https://goerli-optimism.etherscan.io/tx/${hash}`;
    }
    return `https://optimistic.etherscan.io/tx/${hash}`;
  } else if (chain.includes("arbitrum")) {
    if (chain.includes("goerli")) {
      return `https://goerli.arbiscan.io/tx/${hash}`;
    }
    if (chain.includes("nova")) {
      return `https://nova.arbiscan.io/tx/${hash}`;
    }
    return `https://arbiscan.io/tx/${hash}`;
  }
  return "";
  /* c8 ignore stop */
}

export async function getWalletWithProvider({
  privateKey,
  chain,
  providerUrl,
}: Options): Promise<Wallet> {
  if (privateKey == null) {
    throw new Error("missing required flag (`-k` or `--privateKey`)");
  }
  let network: helpers.ChainInfo;
  try {
    network = helpers.getChainInfo(chain);
  } catch (e) {
    throw new Error("unsupported chain (see `chains` command for details)");
  }

  const wallet = new Wallet(privateKey);

  // We want to acquire a provider using the params given by the caller.
  let provider: providers.BaseProvider | undefined;
  // first we check if a providerUrl was given.
  if (typeof providerUrl === "string") {
    provider = new providers.JsonRpcProvider(providerUrl, network.name);
  }

  // Second we will check if the "local-tableland" chain is being used,
  // because the default provider won't work with this chain.
  if (provider == null && network.chainName === "local-tableland") {
    provider = new providers.JsonRpcProvider("http://127.0.0.1:8545");
  }

  // Finally we use the default provider
  /* c8 ignore start */
  if (provider == null) {
    try {
      // This will be significantly rate limited, but we only need to run it once
      provider = getDefaultProvider({ ...network, name: network.chainName });
    } catch (err: any) {
      // ethers.js only gives away default provider keys for some networks
      throw new Error(
        "no default provider is available for this network, you must provide one via flag (`-p` or `--providerUrl`)"
      );
    }
  }

  if (provider == null) {
    throw new Error("unable to create ETH API provider");
  }

  let providerChainId: number | undefined;
  try {
    providerChainId = (await provider.getNetwork()).chainId;
  } catch (err) {
    throw new Error("cannot determine provider chain ID");
  }

  if (providerChainId !== network.chainId) {
    throw new Error("provider / chain mismatch");
  }

  /* c8 ignore stop */
  return wallet.connect(provider);
}

// Wrap any direct calls to console.log, so that test spies can distinguish between
// the CLI's output, and messaging that originates outside the CLI
export const logger = {
  log: function (message: string) {
    console.log(message);
  },
  table: function (message: unknown[] | undefined) {
    console.table(message);
  },
  error: function (message: string | unknown) {
    console.error(message);
  },
};

/**
 * Check if a table aliases file exists, or if a directory exists where we can
 * create a new one (note: only used with `init`, where creation can happen).
 * @param path Path to existing aliases file or directory to create one at.
 * @returns The type of the path, either "file" or "dir".
 */
/* c8 ignore start */
export function checkAliasesPath(path: string): string {
  let type;
  let isStatErr;
  try {
    const stats = statSync(path);
    if (stats.isFile() && extname(path) === ".json") type = "file"; // only set "type" if it's JSON
    if (stats.isDirectory()) type = "dir";
  } catch {
    isStatErr = true;
  }
  if (type === undefined || isStatErr != null)
    throw new Error("invalid table aliases path");
  return type;
}
/* c8 ignore stop */

/**
 * Check if a table aliases file exists and is JSON.
 * @param path Path to existing aliases file.
 * @returns true if the file exists and is JSON, false otherwise.
 */
export function isValidAliasesFile(path: string): boolean {
  try {
    const stats = statSync(path);
    if (stats.isFile() && extname(path) === ".json") return true;
  } catch {
    /* c8 ignore next 4 */
    return false;
  }
  return false;
}

// Recreate SDK helper's `jsonFileAliases` but with updating the file, not overwriting
type NameMapping = Record<string, string>;

interface AliasesNameMap {
  read: () => Promise<NameMapping>;
  write: (map: NameMapping) => Promise<void>;
}

export function jsonFileAliases(filepath: string): AliasesNameMap {
  const isValid = isValidAliasesFile(filepath);
  if (!isValid) {
    throw new Error(`invalid table aliases file`);
  }
  return {
    read: async function (): Promise<NameMapping> {
      const file = readFileSync(filepath);
      return JSON.parse(file.toString());
    },
    write: async function (nameMap: NameMapping) {
      const file = readFileSync(filepath);
      const original = JSON.parse(file.toString());
      const merged = { ...original, ...nameMap };
      writeFileSync(filepath, JSON.stringify(merged));
    },
  };
}

export async function getTableNameWithAlias(
  filepath: string,
  name: string
): Promise<string> {
  const nameMap = await jsonFileAliases(filepath).read();
  const uuName = nameMap[name];
  return uuName ?? name;
}
