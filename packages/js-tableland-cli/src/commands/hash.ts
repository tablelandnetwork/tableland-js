import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { connect, ConnectOptions, ChainName } from "@tableland/sdk";
import { getSignerOnly } from "../utils.js";

export type Options = {
  // Local
  schema: string;
  prefix: string | undefined;

  // Global
  privateKey: string;
  chain: ChainName;
};

export const command = "hash <schema>";
export const desc = "Validate a table schema and get the structure hash";

export const builder: CommandBuilder<{}, Options> = (yargs) =>
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
  const { schema, prefix, privateKey, chain } = argv;

  try {
    const signer = getSignerOnly({
      privateKey,
      chain,
    });
    const options: ConnectOptions = {
      chain,
      signer,
      rpcRelay: false,
    };
    const res = await connect(options).hash(schema, { prefix });
    const out = JSON.stringify(res, null, 2);
    console.log(out);
    /* c8 ignore next 3 */
  } catch (err: any) {
    console.error(err.message);
  }
};
