import { createInterface } from "readline";
import { type Arguments, type CommandBuilder } from "yargs";
import type yargs from "yargs";
import { type GlobalOptions } from "../cli.js";
import { type Connections, setupCommand } from "../lib/commandSetup.js";
import { logger } from "../utils.js";

const help = `Commands:
[query] - run a query
.exit - exit the shell
.help - show this help

SQL Queries can be multi-line, and must end with a semicolon (;)`;

export interface Options extends GlobalOptions {
  statement?: string;
  format: "pretty" | "table" | "objects";
}

export const command = "shell [statement]";
export const desc =
  "Interact with tableland via an interactive shell environment";
export const aliases = ["s", "sh"];

process.on("SIGINT", function () {
  /* c8 ignore next 2 */
  logger.log("Caught interrupt signal");
  process.exit();
});

async function confirmQuery(): Promise<boolean> {
  return await new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      "You are sending a transaction to the network, using gas. Are you sure? (y/n) ",
      (answer) => {
        const response = answer.toLowerCase();
        rl.close();

        if (response === "y" || response === "yes") {
          resolve(true);
        } else {
          logger.log("Aborting.");
          resolve(false);
        }
      }
    );
  });
}

async function fireFullQuery(
  statement: string,
  tablelandConnection: Connections
): Promise<void> {
  try {
    const { database } = tablelandConnection;

    const { type } = await globalThis.sqlparser.normalize(statement);
    if (type !== "read" && !(await confirmQuery())) return;

    const stmt = database.prepare(statement);
    const response = await stmt.all();

    logger.log(JSON.stringify(response.results));
    const tableName = response.meta.txn?.name;
    // Check if table aliases are enabled and, if so, include them in the logging
    let tableAlias;
    const aliasesEnabled = database.config.aliases != null;
    if (aliasesEnabled) {
      const tableAliases = await database.config.aliases?.read();
      if (tableAliases != null) {
        tableAlias = Object.keys(tableAliases).find(
          (alias) => tableAliases[alias] === tableName
        );
      }
    }
    const logDataCreate: Partial<{ createdTable: string; alias: string }> = {
      createdTable: tableName,
    };
    const logDataWrite: Partial<{ updatedTable: string; alias: string }> = {
      updatedTable: tableName,
    };
    if (tableAlias != null) {
      logDataCreate.alias = tableAlias;
      logDataWrite.alias = tableAlias;
    }
    switch (type) {
      case "create":
        logger.log(JSON.stringify(logDataCreate));
        break;
      case "write":
        logger.log(JSON.stringify(logDataWrite));
        break;
      default:
    }

    /* c8 ignore next 3 */
  } catch (err: any) {
    logger.error(
      typeof err?.cause?.message === "string"
        ? err?.cause?.message
        : err?.message
    );
    logger.error(err);
  }
}

async function shell(
  argv: any,
  tablelandConnection: Connections,
  history: string[] = []
): Promise<void> {
  try {
    if (argv.statement != null) {
      await fireFullQuery(argv.statement, tablelandConnection);
      delete argv.statement;
    } else {
      let statement = "";
      const rl = createInterface({
        history,
        input: process.stdin,
        output: process.stdout,
        prompt: "tableland> ",
        terminal: true,
      });
      rl.prompt();
      rl.on("history", (newHistory) => {
        history = newHistory;
      });
      rl.on("SIGINT", () => {
        /* c8 ignore next 1 */
        process.exit();
      });

      for await (const enter of rl) {
        const state = enter;
        statement += "\r\n";
        statement += state;
        rl.setPrompt("      ...>");
        if (statement.trim().startsWith(".")) {
          const command = statement.trim().split(" ")[0].replace(".", "");
          switch (command) {
            case "exit":
              process.exit();
              break;
            case "help":
            default:
              logger.log(help);
              break;
          }
        }
        if (state.trim().endsWith(";") || statement.trim().startsWith(".")) {
          break;
        }
        rl.prompt();
      }
      rl.close();
      if (!statement.trim().startsWith(".")) {
        await fireFullQuery(statement, tablelandConnection);
      }
    }

    // NOTE: we must use catch here instead of awaiting because this is calling
    //       itself and the tests will hang forever if we use `await`
    shell(argv, tablelandConnection, history).catch((err) => {
      /* c8 ignore next 1 */
      logger.error(err);
    });
    /* c8 ignore next 6 */
  } catch (err: any) {
    logger.error(err.message);
    if (argv.verbose === true) {
      logger.log(err);
    }
  }
}

export const builder: CommandBuilder<Record<string, unknown>, Options> = (
  yargs
) =>
  yargs
    .positional("statement", {
      type: "string",
      description: "Initial query (optional)",
    })
    .option("verbose", {
      alias: "v",
      type: "boolean",
      description: "Results show more data",
    })
    .option("format", {
      type: "string",
      choices: ["pretty", "table", "objects"] as const,
      description: "Output format. One of 'pretty', 'table', or 'objects'",
      default: "pretty",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  try {
    const { chain } = argv;
    if (chain == null) {
      logger.error("missing required flag (`-c` or `--chain`)");
      return;
    }
    const connections = await setupCommand(argv);
    const { signer, network } = connections;
    logger.log("Welcome to Tableland");
    logger.log(`Tableland CLI shell`);
    logger.log(
      `Connected to ${network.chainName} using ${await signer.getAddress()}`
    );

    await shell(argv, connections);
  } catch (e: any) {
    logger.error(e.message);
  }
};
