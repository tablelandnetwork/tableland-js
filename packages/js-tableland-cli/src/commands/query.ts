import type { Arguments, CommandBuilder } from "yargs";
import { Wallet, providers } from "ethers";
import { connect, ConnectionOptions } from "@textile/tableland";
import yargs from "yargs";

type Options = {
  // Local
  statement: string;
  token: string;

  // Global
  privateKey: string;
  host: string;
};

export const command = "query <statement>";
export const desc = "Run a query against a remote table";

export const builder: CommandBuilder<Options, Options> = (yargs) =>
  yargs
    .option("t", {
      alias: "token",
      type: "string",
      description: "Signed JWT token (see `jwt --help`)",
    })
    .positional("statement", {
      type: "string",
      description: "SQL statement",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { privateKey, host, token, statement } = argv;
  const options: ConnectionOptions = {};
  if (privateKey) {
    // FIXME: This is a hack due to js-tableland's restrictive use of provider
    // See: https://github.com/textileio/js-tableland/issues/22
    options.signer = new Wallet(privateKey, {
      getNetwork: async () => {
        return {
          name: "rinkeby",
          chainId: 4,
        };
      },
      _isProvider: true,
    } as providers.Provider);
  }
  if (token) {
    options.token = { token };
  }
  if (host) {
    options.host = host;
  }
  const tbl = await connect(options);
  if (statement.toLowerCase().startsWith("create")) {
    throw new Error(
      "Cannot create table as part of SQL query (see `create --help`)"
    );
  }
  const res = await tbl.query(statement);
  const out = JSON.stringify(res, null, 2);
  process.stdout.write(`${out}\n`);
  process.exit(0);
};
