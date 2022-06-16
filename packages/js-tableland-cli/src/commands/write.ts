import type { Arguments, CommandBuilder } from "yargs";
import { connect, ConnectOptions } from "@tableland/sdk";
import yargs from "yargs";

type Options = {
  // Local
  statement: string;

  // Global
  host: string;
  token: string;
};

export const command = "write <statement>";
export const desc = "Run a mutating SQL statement against a remote table";

export const builder: CommandBuilder<Options, Options> = (yargs) =>
  yargs.positional("statement", {
    type: "string",
    description: "SQL write statement",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { host, token, statement } = argv;
  if (!token) {
    console.error("missing required flag (`-t` or `--token`)\n");
    process.exit(1);
  }
  const options: ConnectOptions = {
    host,
  };
  if (token) {
    options.token = { token };
  }
  const tbl = await connect(options);
  const res = await tbl.write(statement);
  const out = JSON.stringify(res, null, 2);
  process.stdout.write(`${out}\n`);
  process.exit(0);
};
