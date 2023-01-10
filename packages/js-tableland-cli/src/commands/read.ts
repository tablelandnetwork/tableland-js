import type { Arguments, CommandBuilder } from "yargs";
import { Database, ChainName } from "@tableland/sdk";
import yargs from "yargs";
import { promises } from "fs";
import { createInterface } from "readline";
import { getChains } from "../utils.js";

export type Options = {
  // Local
  statement?: string;
  format: "pretty" | "table" | "objects";
  file?: string;

  // Global
  chain: ChainName;
};

export const command = "read [statement]";
export const desc = "Run a read-only query against a remote table";
export const aliases = ["r", "query", "q"];

export const builder: CommandBuilder<{}, Options> = (yargs) =>
  yargs
    .positional("statement", {
      type: "string",
      description: "Input SQL statement (skip to read from stdin)",
    })
    .option("format", {
      type: "string",
      choices: ["pretty", "table", "objects"] as const,
      description: "Output format. One of 'pretty', 'table', or 'objects'.",
      default: "table",
    })
    .option("file", {
      type: "string",
      alias: "f",
      description: "Get statement from input file",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  let { statement } = argv;
  const { chain, format, file } = argv;

  const network = getChains()[chain];
  if (!network) {
    console.error("unsupported chain (see `chains` command for details)");
    return;
  }

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
    const db = await Database.readOnly(chain);
    const res = await db.prepare(statement).all();

    if (format === "pretty") {
      console.table(res.results);
    } else {
      const out = res;
      console.log(out);
    }
    /* c8 ignore next 3 */
  } catch (err: any) {
    console.error(err?.cause?.message || err?.message);
  }
};
