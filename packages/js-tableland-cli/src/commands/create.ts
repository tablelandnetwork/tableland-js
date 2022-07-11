import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { Wallet, providers, getDefaultProvider } from "ethers";
import { connect, ConnectOptions, ChainName } from "@tableland/sdk";
import getChains from "../chains";

type Options = {
  // Local
  schema: string;
  prefix: string | undefined;

  // Global
  privateKey: string;
  chain: ChainName;
  alchemy: string | undefined;
  infura: string | undefined;
  etherscan: string | undefined;
};

export const command = "create <schema> [prefix]";
export const desc = "Create a new table";

export const builder: CommandBuilder<Options, Options> = (yargs) =>
  yargs
    .positional("schema", {
      type: "string",
      description: "SQL table schema",
    })
    .option("prefix", {
      type: "string",
      description: "Table name prefix",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { schema, prefix, privateKey, chain, alchemy, infura, etherscan } =
    argv;

  if (!privateKey) {
    console.error("missing required flag (`-k` or `--privateKey`)\n");
    process.exit(1);
  }
  const network = getChains()[chain];
  if (!network) {
    console.error("unsupported chain (see `chains` command for details)\n");
    process.exit(1);
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
    console.error("unable to create ETH API provider\n");
    process.exit(1);
  }

  const options: ConnectOptions = {
    chain,
    signer: wallet.connect(provider),
  };
  const tbl = await connect(options);
  const res = await tbl.create(schema, prefix);
  const out = JSON.stringify(
    { ...res, tableId: (res.tableId ?? "").toString() },
    null,
    2
  );
  console.log(out);
  process.exit(0);
};
