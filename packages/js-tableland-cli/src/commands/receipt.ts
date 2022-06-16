import type { Arguments, CommandBuilder } from "yargs";
import { connect, ConnectOptions } from "@tableland/sdk";
import yargs from "yargs";

type Options = {
  // Local
  hash: string;

  // Global
  token: string;
  host: string;
};

export const command = "receipt <hash>";
export const desc =
  "Get the receipt of a chain transaction to know if it was executed, and the execution details";

export const builder: CommandBuilder<Options, Options> = (yargs) =>
  yargs.positional("hash", {
    type: "string",
    description: "Transaction hash",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { hash, host, token } = argv;
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
  const res = await tbl.receipt(hash);
  const out = JSON.stringify(res, null, 2);
  console.log(out);
  process.exit(0);
};
