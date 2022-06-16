import type { Arguments, CommandBuilder } from "yargs";
import { connect, resultsToObjects, ConnectOptions } from "@tableland/sdk";
import yargs from "yargs";

type Options = {
  // Local
  query: string;
  format: "raw" | "table" | "objects";

  // Global
  host: string;
};

export const command = "read <query>";
export const desc = "Run a read-only query against a remote table";

export const builder: CommandBuilder<Options, Options> = (_yargs) =>
  yargs
    .positional("query", {
      type: "string",
      description: "SQL query statement",
    })
    .option("format", {
      type: "string",
      description: "Output format. One of 'raw', 'tabular', or 'objects'.",
      default: "raw",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { host, query, format } = argv;
  const options: ConnectOptions = {
    host,
  };
  const tbl = await connect(options);
  const res = await tbl.read(query);
  const formatted = format === "raw" ? res : resultsToObjects(res);

  if (format.startsWith("tab")) {
    console.table(formatted);
  } else {
    const out = JSON.stringify(formatted, null, 2);
    console.log(out);
  }
  process.exit(0);
};
