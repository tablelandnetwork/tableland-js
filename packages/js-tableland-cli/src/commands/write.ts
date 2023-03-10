import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { getLink } from "../utils.js";
import { promises } from "fs";
import { createInterface } from "readline";
import { GlobalOptions } from "../cli.js";
import { setupCommand } from "../lib/commandSetup.js";

export interface Options extends GlobalOptions {
  statement?: string;
  file?: string;
}

export const command = "write [statement]";
export const desc = "Run a mutating SQL statement against a remote table";
export const aliases = ["w", "run", "r"];

export const builder: CommandBuilder<{}, Options> = (yargs) =>
  yargs
    .positional("statement", {
      type: "string",
      description: "Input SQL statement (skip to read from stdin)",
    })
    .option("file", {
      alias: "f",
      description: "Get statement from input file",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  let { statement } = argv;
  const { chain, file, privateKey } = argv;

  try {
    // enforce that all args required for this command are available
    if (!privateKey) {
      console.error("missing required flag (`-k` or `--privateKey`)");
      return;
    }
    if (!chain) {
      console.error("missing required flag (`-c` or `--chain`)");
      return;
    }
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

    const link = getLink(chain, res?.meta?.txn?.transactionHash as string);
    const out = { ...res, link };
    console.dir(out, { depth: null });
    /* c8 ignore next 3 */
  } catch (err: any) {
    console.error(err?.cause?.message || err?.message);
    console.error(err);
  }
};
