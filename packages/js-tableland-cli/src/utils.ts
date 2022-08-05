import { Wallet, providers, getDefaultProvider } from "ethers";
import { ChainName } from "@tableland/sdk";
import getChains from "./chains";

export interface Options {
  privateKey: string;
  chain: ChainName;
  alchemy: string | undefined;
  infura: string | undefined;
  etherscan: string | undefined;
}

export function getWallet({
  privateKey,
  chain,
  alchemy,
  infura,
  etherscan,
}: Options): Wallet {
  if (!privateKey) {
    throw new Error("missing required flag (`-k` or `--privateKey`)");
  }
  const network = getChains()[chain];
  if (!network) {
    throw new Error("unsupported chain (see `chains` command for details)");
  }

  const wallet = new Wallet(privateKey);
  let provider: providers.BaseProvider | undefined;
  if (chain === "local-tableland") {
    provider = new providers.JsonRpcProvider({
      url: "http://localhost:8545",
    });
  } else if (infura) {
    provider = new providers.InfuraProvider(network, infura);
  } else if (etherscan) {
    provider = new providers.EtherscanProvider(network, etherscan);
  } else if (alchemy) {
    provider = new providers.AlchemyProvider(network, alchemy);
  } else {
    // This will be significantly rate limited, but we only need to run it once
    provider = getDefaultProvider(network);
  }
  if (!provider) {
    throw new Error("unable to create ETH API provider");
  }
  return wallet.connect(provider);
}
