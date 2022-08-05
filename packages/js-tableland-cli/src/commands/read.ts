import type { Arguments, CommandBuilder } from "yargs";
import {
  connect,
  resultsToObjects,
  ConnectOptions,
  ChainName,
} from "@tableland/sdk";
import yargs from "yargs";
import getChains from "../chains";

type Options = {
  // Local
  query: string;
  format: "raw" | "table" | "objects";

  // Global
  chain: ChainName;
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
  const { query, format, chain } = argv;

  const network = getChains()[chain];
  if (!network) {
    console.error("unsupported chain (see `chains` command for details)\n");
    process.exit(1);
  }

  const options: ConnectOptions = {
    chain,
  };
  try {
    const res = await connect(options).read(query);
    const formatted = format === "raw" ? res : resultsToObjects(res);

    if (format.startsWith("tab")) {
      console.table(formatted);
    } else {
      const out = JSON.stringify(formatted, null, 2);
      console.log(out);
    }
    process.exit(0);
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
};
