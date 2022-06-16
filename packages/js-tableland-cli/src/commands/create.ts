import type { Arguments, CommandBuilder } from "yargs";
import { Wallet, providers, getDefaultProvider } from "ethers";
import {
  connect,
  ConnectOptions,
  SUPPORTED_CHAINS,
  ChainName,
} from "@tableland/sdk";
import yargs from "yargs";

type Options = {
  // Local
  schema: string;
  prefix: string | undefined;

  // Global
  privateKey: string;
  host: string;
  chain: ChainName;
  alchemy: string | undefined;
  infura: string | undefined;
  etherscan: string | undefined;
  token: string;
};

const supportedNetworks = Object.fromEntries(
  Object.entries(SUPPORTED_CHAINS).map(([key, value]) => [key, value.name])
);

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
  const {
    privateKey,
    host,
    token,
    schema,
    prefix,
    alchemy,
    infura,
    etherscan,
    chain,
  } = argv;

  const options: ConnectOptions = {
    host,
  };
  if (token) {
    options.token = { token };
  }
  if (!privateKey) {
    console.error("missing required flag (`-k` or `--privateKey`)\n");
    process.exit(1);
  }

  const wallet = new Wallet(privateKey);
  let provider: providers.BaseProvider | undefined;
  if (infura) {
    provider = new providers.InfuraProvider(supportedNetworks[chain], infura);
  } else if (etherscan) {
    provider = new providers.EtherscanProvider(
      supportedNetworks[chain],
      etherscan
    );
  } else if (alchemy) {
    provider = new providers.AlchemyProvider(supportedNetworks[chain], alchemy);
  } else {
    // This will be significantly rate limited, but we only need to run it once
    provider = getDefaultProvider(supportedNetworks[chain]);
  }

  if (!provider) {
    console.error("unable to create ETH API provider\n");
    process.exit(1);
  }
  options.signer = wallet.connect(provider);
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
