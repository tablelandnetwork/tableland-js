import type { Arguments, CommandBuilder } from "yargs";
import { Wallet, providers, getDefaultProvider } from "ethers";
import { connect, ConnectionOptions } from "@textile/tableland";
import yargs from "yargs";

type Options = {
  // Local
  statement: string;
  description: string | undefined;
  alchemy: string | undefined;
  infura: string | undefined;
  etherscan: string | undefined;
  token: string;

  // Global
  privateKey: string;
  host: string;
  network: "rinkeby";
};

export const command =
  "create <statement> [description] [alchemy] [infura] [etherscan]";
export const desc = "Create a new unique table";

export const builder: CommandBuilder<Options, Options> = (yargs) =>
  yargs
    .options({
      description: {
        type: "string",
        description: "Table description",
      },
      alchemy: {
        type: "string",
        description: "Alchemy provider API key",
      },
      infura: {
        type: "string",
        description: "Infura provider API key",
      },
      etherscan: {
        type: "string",
        description: "Etherscan provider API key",
      },
    })
    .option("t", {
      alias: "token",
      type: "string",
      description: "Signed JWT token (see `jwt --help`)",
    })
    .positional("statement", {
      type: "string",
      description: "SQL CREATE statement",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const {
    privateKey,
    host,
    token,
    statement,
    description,
    alchemy,
    infura,
    etherscan,
    network,
  } = argv;
  const options: ConnectionOptions = {};
  if (!privateKey) {
    throw new Error("private key string required for create statements");
  }

  const wallet = new Wallet(privateKey);
  let provider: providers.BaseProvider | undefined;
  if (infura) {
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
    throw new Error("Unable to create ETH API provider");
  }
  options.signer = wallet.connect(provider);
  if (token) {
    options.token = { token };
  }
  if (host) {
    options.host = host;
  }
  const tbl = await connect(options);
  const res = await tbl.create(statement, { description });
  const out = JSON.stringify(res, null, 2);
  process.stdout.write(`${out}\n`);
  process.exit(0);
};
