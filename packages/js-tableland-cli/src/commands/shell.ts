import yargs, { Arguments, CommandBuilder } from "yargs";
import cliSelect from "cli-select";
import chalk from "chalk";
import { createInterface } from "readline";

import { GlobalOptions } from "../cli.js";
import { Connections, setupCommand } from "../lib/commandSetup.js";

export interface Options extends GlobalOptions {
  statement?: string;
  format: "pretty" | "table" | "objects";
}

export const command = "shell [statement]";
export const desc =
  "Interact with tableland via an interactive shell environment";
export const aliases = ["s", "sh"];

process.on("SIGINT", function () {
  console.log("Caught interrupt signal");

  process.exit();
});

async function confirmQuery() {
  const selected = await cliSelect({
    values: {
      confirm: "Confirm: Send this transaction to the network",
      deny: "Oops. No, don't send that transaction.",
      // fireAndForget:
      //   "Fire and forget: Send, but don't want for confirmation. DO NOT RECOMMEND.",
    },
    valueRenderer: (value, selected) => {
      if (selected) {
        return chalk.underline(value);
      }
      return value;
    },
  });

  console.log(chalk.bgBlue(selected.id));
  if (selected.id === "confirm") {
    console.log(
      chalk.underline("Committing to network. This will take a few moments.")
    );
  }

  return selected.id;
}

async function fireFullQuery(
  statement: string,
  argv: any,
  tablelandConnection: Connections
) {
  try {
    const { type } = await globalThis.sqlparser.normalize(statement);
    const { database, ens } = tablelandConnection;

    if (argv.enableEnsExperiment && ens) {
      statement = await ens.resolve(statement);
    }

    let stmt;
    let confirm: any = true;

    if (type === "write" || type === "create") {
      confirm = (await confirmQuery()) === "confirm";
    }
    if (!confirm) return;
    try {
      stmt = database.prepare(statement);
      const response = await stmt.all();
      const { results } = response;

      switch (type) {
        case "create":
          console.log(`Created table: ${response.meta.txn?.name}`);
          break;
        case "write":
          console.log(`Updated table: ${response.meta.txn?.name}`);
          break;
        case "read":
          console.log(results);
          break;
        default:
          console.log(response);
      }
      if (argv.verbose) {
        console.log(response);
      }
    } catch (e) {
      console.error(e);
    }
    /* c8 ignore next 3 */
  } catch (e) {
    console.log(e);
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
        process.exit();
      });

      for await (const enter of rl) {
        const state = enter;
        statement += "\r\n";
        statement += state;
        rl.setPrompt("      ...>");

        if (state.trim().endsWith(";")) {
          break;
        }
        rl.prompt();
      }
      rl.close();
      await fireFullQuery(statement, argv, tablelandConnection);
    }

    shellYeah(argv, tablelandConnection, history);
  } catch (err: any) {
    console.error(err.message);
    if (argv.verbose) {
      console.log(err);
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
    const connections = await setupCommand(argv);
    const { signer, network } = connections;
    console.log("Welcome to Tableland");
    console.log(`Tableland CLI shell`);
    console.log(
      `Connected to ${network.chainName} using ${await signer.getAddress()}`
    );
    if (argv.enableEnsExperiment) {
      console.log(
        "ENS namespace is experimental, no promises that it will exist in future builds"
      );
    }

    await shellYeah(argv, connections);
  } catch (e: any) {
    console.error(e.message);
  }
};
