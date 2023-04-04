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
  extract?: boolean;
  unwrap?: boolean;
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
    })
    .option("extract", {
      type: "boolean",
      description:
        "Returns only the set of values of a single column. Read statement must be require only a single column.",
      default: false,
    })
    .option("unwrap", {
      type: "boolean",
      description:
        "Returns the results of a single row instead of array of results. Read statement must result in a single row response.",
      default: false,
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  let { statement } = argv;
  const { format, file, unwrap, extract } = argv;

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

    const setup = await setupCommand(argv);
    const { database: db, ens } = setup;

    if (argv.enableEnsExperiment && ens) {
      statement = await ens.resolve(statement);
    }

    let res;
    if ((format === "table" || format === "objects") && (unwrap || extract)) {
      if (!argv.chain) {
        throw new Error("Chain ID is required to use unwrap or extract");
      }
      const { validator } = setup;
      try {
        res = await validator.queryByStatement({
          statement,
          extract: argv.extract,
          format: "objects",
          unwrap: argv.unwrap,
        });
      } catch (e: any) {
        if (e.message.includes("in JSON at position")) {
          console.log("Can't unwrap multiple rows. Use --unwrap=false");
        } else {
          throw e;
        }
      }
    } else {
      res = (await db.prepare(statement).all()).results;
    }

    switch (format) {
      case "pretty":
        console.table(res);
        break;
      case "objects":
        console.log(JSON.stringify(res));
        break;
      case "table":
        console.log(JSON.stringify(transformTableData(res)));
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
