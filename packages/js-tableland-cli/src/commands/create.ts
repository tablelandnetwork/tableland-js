import type { Arguments, CommandBuilder } from "yargs";
import { Wallet, providers } from "ethers";
import { connect, ConnectionOptions } from "@textile/tableland";
import yargs from "yargs";

type Options = {
  // Local
  statement: string;
  description: string | undefined;
  alchemy: string | undefined;
  infura: string | undefined;
  token: string;

  // Global
  privateKey: string;
  host: string;
};

export const command = "create <statement> [description] [alchemy] [infura]";
export const desc = "Run a query against a remote table";

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
        description: "Infura provide API key",
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
  const { privateKey, host, token, statement, description, alchemy, infura } =
    argv;
  const options: ConnectionOptions = {};
  if (!privateKey) {
    throw new Error("private key string required for create statements");
  }

  const wallet = new Wallet(privateKey);
  if (!alchemy && !infura) {
    throw new Error("ETH provider API required for create statements");
  }
  let provider: providers.JsonRpcProvider | undefined;
  if (alchemy) {
    provider = new providers.AlchemyProvider("rinkeby", alchemy);
  } else if (infura) {
    provider = new providers.InfuraProvider("rinkeby", infura);
  }
  if (!provider) {
    throw new Error("Unable to create ETH API provider");
  }
  options.signer = wallet.connect(provider);
  if (token) {
    options.jwsToken = { token };
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
