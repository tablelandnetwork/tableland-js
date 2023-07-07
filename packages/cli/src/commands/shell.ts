import yargs, { Arguments, CommandBuilder } from "yargs";
import { createInterface } from "readline";
import { GlobalOptions } from "../cli.js";
import { Connections, setupCommand } from "../lib/commandSetup.js";
import { logger } from "../utils.js";

const help = `Commands:
[query] - run a query
.exit - exit the shell
.help - show this help

SQL Queries can be multi-line, and must end with a semicolon (;).`;

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

async function confirmQuery() {
  return new Promise((resolve) => {
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
  argv: any,
  tablelandConnection: Connections
) {
  try {
    const { database, ens } = tablelandConnection;
    if (argv.enableEnsExperiment && ens) {
      statement = await ens.resolve(statement);
    }

    const { type } = await globalThis.sqlparser.normalize(statement);
    if (type !== "read" && !(await confirmQuery())) return;

    const stmt = database.prepare(statement);
    const response = await stmt.all();

    logger.log(JSON.stringify(response.results));
    switch (type) {
      case "create":
        logger.log(JSON.stringify({ createdTable: response.meta.txn?.name }));
        break;
      case "write":
        logger.log(JSON.stringify({ updatedTable: response.meta.txn?.name }));
        break;
      default:
    }
    /* c8 ignore next 3 */
  } catch (err: any) {
    logger.error(err?.cause?.message || err?.message);
    logger.error(err);
  }
}

async function shellYeah(
  argv: any,
  tablelandConnection: Connections,
  history: string[] = []
) {
  try {
    if (argv.statement) {
      await fireFullQuery(argv.statement, argv, tablelandConnection);
      delete argv.statement;
    } else {
      let statement = "";
      const rl = createInterface({
        history,
        input: process.stdin,
        output: process.stdout,
        prompt: "tableland>",
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
        await fireFullQuery(statement, argv, tablelandConnection);
      }
    }

    shellYeah(argv, tablelandConnection, history);
    /* c8 ignore next 6 */
  } catch (err: any) {
    logger.error(err.message);
    if (argv.verbose) {
      logger.log(err);
    }
  }
}

export const builder: CommandBuilder<{}, Options> = (yargs) =>
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
      description: "Output format. One of 'pretty', 'table', or 'objects'.",
      default: "pretty",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  try {
    const { chain } = argv;
    if (!chain) {
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
    if (argv.enableEnsExperiment) {
      logger.log(
        "ENS namespace is experimental, no promises that it will exist in future builds"
      );
    }

    await shellYeah(argv, connections);
  } catch (e: any) {
    logger.error(e.message);
  }
};
