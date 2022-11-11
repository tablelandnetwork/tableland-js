import { Wallet, providers, getDefaultProvider } from "ethers";
import { ChainName, SUPPORTED_CHAINS } from "@tableland/sdk";

export const getChains = () =>
  Object.fromEntries(
    Object.entries(SUPPORTED_CHAINS).filter(
      ([name]) => !name.includes("staging")
    )
  );

export interface Options {
  privateKey: string;
  chain: ChainName;
  providerUrl: string | undefined;
}

export const wait = (timeout: number) =>
  new Promise((resolve) => setTimeout(resolve, timeout));

export function getLink(chain: ChainName, hash: string): string {
  /* c8 ignore start */
  if (chain.includes("ethereum")) {
    if (chain.includes("goerli")) {
      return `https://goerli.etherscan.io/tx/${hash}`;
    }
    return `https://etherscan.io/tx/${hash}`;
  } else if (chain.includes("polygon")) {
    if (chain.includes("mumbai")) {
      return `https://mumbai.polygonscan.com/tx/${hash}`;
    }
    return `https://polygonscan.com/tx/${hash}`;
  } else if (chain.includes("optimism")) {
    if (chain.includes("goerli")) {
      return `https://blockscout.com/optimism/goerli/tx/${hash}`;
    }
    return `https://optimistic.etherscan.io/tx/${hash}`;
  } else if (chain.includes("arbitrum")) {
    if (chain.includes("goerli")) {
      return `https://goerli-rollup-explorer.arbitrum.io/tx/${hash}`;
    }
    return `https://arbiscan.io/tx/${hash}`;
  }
  return "";
  /* c8 ignore stop */
}

export function getSignerOnly({
  privateKey,
  chain,
}: {
  privateKey: string;
  chain: ChainName;
}): Wallet {
  if (privateKey == null) {
    throw new Error("missing required flag (`-k` or `--privateKey`)");
  }
  const network = getChains()[chain];
  if (network == null) {
    throw new Error("unsupported chain (see `chains` command for details)");
  }

  // FIXME: This is a hack due to a regression in js-tableland
  // See: https://github.com/tablelandnetwork/js-tableland/issues/22
  const signer = new Wallet(privateKey, {
    getNetwork: async () => {
      return network;
    },
    _isProvider: true,
  } as unknown as providers.Provider);
  return signer;
}

export function getWalletWithProvider({
  privateKey,
  chain,
  providerUrl,
}: Options): Wallet {
  if (privateKey == null) {
    throw new Error("missing required flag (`-k` or `--privateKey`)");
  }
  const network = getChains()[chain];
  if (network == null) {
    throw new Error("unsupported chain (see `chains` command for details)");
  }

  const wallet = new Wallet(privateKey);
  let provider: providers.BaseProvider = new providers.JsonRpcProvider(
    chain === "local-tableland" ? undefined : providerUrl, // Defaults to localhost
    network.name === "localhost" ? undefined : network.name
  );
  /* c8 ignore start */
  if (!provider) {
    // This will be significantly rate limited, but we only need to run it once
    provider = getDefaultProvider(network);
  }
  if (!provider) {
    throw new Error("unable to create ETH API provider");
  }
  /* c8 ignore stop */
  return wallet.connect(provider);
}
