import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { getLink, logger } from "../utils.js";
import { createInterface } from "readline";
import { promises } from "fs";
import { GlobalOptions } from "../cli.js";
import { setupCommand } from "../lib/commandSetup.js";

export interface Options extends GlobalOptions {
  schema?: string;
  prefix?: string;
  file?: string;
  ns?: string;
}

export const command = "create [schema] [prefix]";
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
    .option("ns", {
      type: "string",
      description: "ENS namespace to resolve schema from (experimental)",
    })
    .option("file", {
      alias: "f",
      description: "Get statement from input file",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  try {
    let { schema } = argv;
    const { chain, file, prefix, privateKey } = argv;
    // enforce that all args required for this command are available
    if (!privateKey) {
      logger.error("missing required flag (`-k` or `--privateKey`)");
      return;
    }
    if (!chain) {
      logger.error("missing required flag (`-c` or `--chain`)");
      return;
    }
    if (file != null) {
      schema = await promises.readFile(file, { encoding: "utf-8" });
    } else if (schema == null) {
      const rl = createInterface({ input: process.stdin });
      const it = rl[Symbol.asyncIterator]();
      const { value } = await it.next();
      schema = value;
    }
    if (!schema) {
      logger.error(
        "missing input value (`schema`, `file`, or piped input from stdin required)"
      );
      return;
    }

    let statement = "";
    const check = /CREATE TABLE/gim.exec(schema.toString());
    if (check) {
      statement = schema;
    } else if (prefix === undefined) {
      logger.error(
        "Must specify --prefix if you do not provide a full Create statement"
      );
    } else {
      statement = `CREATE TABLE ${prefix} (${schema})`;
    }

    // now that we have parsed the command args, run the create operation
    const { database: db, ens, normalize } = await setupCommand(argv);

    if (argv.enableEnsExperiment && ens) {
      statement = await ens.resolve(statement);
    }
    statement = statement
      .replace(/\n/g, "")
      .replace(/\r/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Parse the statement to see if more than one table is affected.
    // If yes, then combine into separate statements and batch.
    // If no, then process via single statement.
    const statements = statement.split(";").filter((stmt) => stmt.trim());
    // NOTE: the wasm-sqlparse will error if you normalize a string with 2 creates,
    //  so we are splitting by semi-colon and then ensuring each statement is a create.
    const normalized = await Promise.all(
      statements.map(async (stmt) => await normalize(stmt))
    );

    if (!normalized.every((norm) => norm.type === "create")) {
      logger.error("the `create` command can only accept create queries");
      return;
    }
    if (statements.length < 1) {
      logger.error(
        "after normalizing the statement there was no create query, hence nothing to do"
      );
      return;
    }

    if (statements.length < 2) {
      // send the original statement as a single create
      const res = await db.prepare(statement).all();
      const link = getLink(chain, res.meta.txn?.transactionHash as string);
      const out = { ...res, link, ensNameRegistered: false };

      if (!check && argv.ns && argv.enableEnsExperiment && prefix) {
        const register = (await ens?.addTableRecords(argv.ns, [
          { key: prefix, value: out.meta.txn?.name as string },
        ])) as boolean;
        out.ensNameRegistered = register;
      }

      logger.log(JSON.stringify(out));
      return;
    }

    const [res] = await db.batch(
      statements.map(function (stmt) {
        return db.prepare(stmt);
      })
    );
    const link = getLink(chain, res.meta.txn?.transactionHash as string);
    const out = { ...res, link, ensNameRegistered: false };

    // TODO: I'm not sure how `check` would be false and statements.length < 2
    //    so I didn't write a test for it
    /* c8 ignore next 6 */
    if (!check && argv.ns && argv.enableEnsExperiment && prefix) {
      const register = (await ens?.addTableRecords(argv.ns, [
        { key: prefix, value: out.meta.txn?.name as string },
      ])) as boolean;
      out.ensNameRegistered = register;
    }

    logger.log(JSON.stringify(out));
    /* c8 ignore next 3 */
  } catch (err: any) {
    logger.error(err?.cause?.message || err.message);
  }
};
