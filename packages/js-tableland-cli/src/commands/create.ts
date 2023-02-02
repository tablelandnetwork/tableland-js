import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { getLink } from "../utils.js";
import { createInterface } from "readline";
import { promises } from "fs";
import { GlobalOptions } from "../cli.js";
import { setupCommand } from "../lib/commandSetup.js";

export interface Options extends GlobalOptions {
  schema?: string;
  prefix?: string;
  file?: string;
}

export const command = "create [schema]";
export const desc = "Create a new table";

export const builder: CommandBuilder<{}, Options> = (yargs) =>
  yargs
    .positional("schema", {
      type: "string",
      description:
        "SQL table schema, or full create statement (skip to read from stdin)",
    })
    .option("prefix", {
      type: "string",
      description:
        "Table name prefix (ignored if full create statement is provided)",
    })
    .option("file", {
      alias: "f",
      description: "Get statement from input file",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  try {
    let { schema } = argv;
    const { chain, file, prefix } = argv;
    const { database, ens } = await setupCommand(argv);
    if (file != null) {
      schema = await promises.readFile(file, { encoding: "utf-8" });
    } else if (schema == null) {
      const rl = createInterface({ input: process.stdin });
      const it = rl[Symbol.asyncIterator]();
      const { value } = await it.next();
      schema = value;
    }
    if (!schema) {
      console.error(
        "missing input value (`schema`, `file`, or piped input from stdin required)"
      );
      return;
    }

    let statement = `CREATE TABLE ${prefix} (${schema})`;

    const check = /CREATE TABLE/gim.exec(schema.toString());
    if (check) {
      statement = schema;
    }

    const db = database;

    if (argv.enableEnsExperiment && ens)
      statement = await ens.resolve(statement);

    const res = await db.prepare(statement).all();
    const link = getLink(chain, res.meta.txn?.transactionHash as string);
    const out = { ...res, link };
    console.log(out);
    /* c8 ignore next 3 */
  } catch (err: any) {
    console.error(err?.cause?.message || err.message);
  }
};
