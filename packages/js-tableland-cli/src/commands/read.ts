import type { Arguments, CommandBuilder } from "yargs";
import yargs from "yargs";
import { promises } from "fs";
import { createInterface } from "readline";
import { GlobalOptions } from "../cli.js";
import { setupCommand } from "../lib/commandSetup.js";

export interface Options extends GlobalOptions {
  statement?: string;
  format: "pretty" | "table" | "objects" | "raw";
  file?: string;
  providerUrl: string;
}

export const command = "read [statement]";
export const desc = "Run a read-only query against a remote table";
export const aliases = ["r", "query", "q"];

function transformTableData(obj: any) {
  if (obj.length < 1) return { columns: [], rows: [] };
  const columns = Object.keys(obj[0]).map((key) => ({ name: key }));
  const rows = obj.map((row: any) => Object.values(row));
  return { columns, rows };
}

export const builder: CommandBuilder<{}, Options> = (yargs) =>
  yargs
    .positional("statement", {
      type: "string",
      description: "Input SQL statement (skip to read from stdin)",
    })
    .option("format", {
      type: "string",
      choices: ["pretty", "table", "objects", "raw"] as const,
      description: "Output format. One of 'pretty', 'table', or 'objects'.",
      default: "objects",
    })
    .option("file", {
      type: "string",
      alias: "f",
      description: "Get statement from input file",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  let { statement } = argv;
  const { format, file } = argv;

  try {
    if (file != null) {
      statement = await promises.readFile(file, { encoding: "utf-8" });
    } else if (statement == null) {
      const rl = createInterface({ input: process.stdin });
      const it = rl[Symbol.asyncIterator]();
      const { value } = await it.next();
      statement = value;
    }
    if (!statement) {
      console.error(
        "missing input value (`statement`, `file`, or piped input from stdin required)"
      );
      return;
    }

    const { database: db, ens } = await setupCommand(argv);

    if (argv.enableEnsExperiment && ens) {
      statement = await ens.resolve(statement);
    }

    const res = await db.prepare(statement).all();

    switch (format) {
      case "pretty":
        console.table(res.results);
        break;
      case "objects":
        console.log(JSON.stringify(res.results));
        break;
      case "table":
        console.log(JSON.stringify(transformTableData(res.results)));
        break;
      case "raw":
        console.log(
          JSON.stringify(transformTableData(await db.prepare(statement).raw()))
        );
        break;
    }

    /* c8 ignore next 3 */
  } catch (err: any) {
    console.error(err?.cause?.message || err?.message);
  }
};
