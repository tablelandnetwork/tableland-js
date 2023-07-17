import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { getLink, logger } from "../utils.js";
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
      logger.error("missing required flag (`-k` or `--privateKey`)");
      return;
    }
    if (!chain) {
      logger.error("missing required flag (`-c` or `--chain`)");
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
      logger.error(
        "missing input value (`statement`, `file`, or piped input from stdin required)"
      );
      return;
    }

    const { database: db, ens, normalize } = await setupCommand(argv);

    if (argv.enableEnsExperiment && ens) {
      statement = await ens.resolve(statement);
    }

    // Parse the statement to see if more than one table is affected.
    // If yes, then combine into separate statements and batch.
    // If no, then process via single statement.
    statement = statement.replace(/\n/i, "").replace(/\r/, "");
    const normalized = await normalize(statement);

    if (normalized.type !== "write" && normalized.type !== "acl") {
      logger.error("the `write` command can only accept write queries");
      return;
    }
    // Note: I can't figure out a write statement that updates 2 tables and makes
    //  it through the parser, but leaving this here because one might exist.
    /* c8 ignore next 6 */
    if (normalized.tables.length < 1) {
      logger.error(
        "after normalizing the statement there was no write query, hence nothing to do"
      );
      return;
    }

    if (normalized.tables.length < 2) {
      const res = await db.prepare(statement).all();

      const link = getLink(chain, res?.meta?.txn?.transactionHash as string);
      const out = { ...res, link };
      logger.log(JSON.stringify(out));
      return;
    }

    // TODO: taking an arbitrary sql string and returning each individual statement with the associated tableId
    //    seems very useful in general.  We should expose this via the SDK or parser.
    const statementsById = (
      await Promise.all(
        normalized.statements.map(async function (stmt) {
          // re-normalize so we can be sure we've isolated each statement and it's tableId
          const norm = await normalize(stmt);
          /* c8 ignore next 5 */
          if (norm.tables.length > 1) {
            throw new Error(
              "cannot normalize if single query affects more then one table"
            );
          }
          const { tableId } = await globalThis.sqlparser.validateTableName(
            norm.tables[0]
          );
          return {
            statement: stmt,
            tableId: tableId.toString(),
          };
        })
      )
    ).reduce(function (acc, cur) {
      // take the re-normalized statements and concatenate the ones that share a tableId
      if (acc[cur.tableId] == null) {
        acc[cur.tableId] = "";
      }

      acc[cur.tableId] += cur.statement;
      return acc;
    }, {} as any);

    const preparedStatements = Object.entries(statementsById).map(function ([
      id,
      stmt,
    ]) {
      /* c8 ignore next 1 */
      if (typeof stmt !== "string") throw new Error("cannot prepare statement");
      return db.prepare(stmt);
    });

    const [res] = await db.batch(preparedStatements);
    const link = getLink(chain, res?.meta?.txn?.transactionHash as string);
    const out = { ...res, link };
    logger.log(JSON.stringify(out));
    /* c8 ignore next 3 */
  } catch (err: any) {
    logger.error(err?.cause?.message || err?.message);
    logger.error(err);
  }
};
