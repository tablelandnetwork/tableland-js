import { resolve, dirname } from "path";
import { mkdirSync, createWriteStream, type WriteStream } from "fs";
import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import yaml from "js-yaml";
import inquirer from "inquirer";
import { findOrCreateAliasesFile } from "@tableland/node-helpers";
import { getChains, logger } from "../utils.js";
import { type GlobalOptions } from "../cli.js";

export interface Options extends GlobalOptions {
  yes: boolean;
  format: "json" | "yaml" | "yml";
  path: string;
}

const defaults = {
  chain: "maticmum",
  rpcRelay: false,
};

const moduleName = "tableland";

export const command = "init";
export const desc = "Create config file";
export const aliases = ["i"];

export const builder: CommandBuilder<Options, Options> = (yargs) => {
  return yargs
    .option("yes", {
      type: "boolean",
      alias: "y",
      description: "Skip the interactive prompts and use default values",
      default: false,
    })
    .option("path", {
      type: "string",
      description: "The path at which to create the config file",
    })
    .option("format", {
      type: "string",
      description: "The output config file format",
      choices: ["json", "yaml"],
    }) as yargs.Argv<Options>;
};

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  // eslint-disable-next-line no-unused-vars
  const { _, $0, yes, chain, ...answers } = argv;
  let output = answers;
  if (!yes) {
    const questions = [
      {
        type: "list",
        name: "chain",
        message: "Select a preferred default chain",
        choices: Object.keys(getChains()),
        askAnswered: true,
        default: chain,
      },
      {
        type: "password",
        name: "privateKey",
        message: "Enter your private key (optional)",
      },
      {
        type: "input",
        name: "providerUrl",
        message: "Enter a default JSON RPC API provider URL (optional)",
      },
      {
        type: "list",
        name: "format",
        message: "Select a config file output format",
        choices: ["json", "yaml"],
        default: "yaml",
      },
      {
        type: "input",
        name: "path",
        message: 'Enter path to store config file (use "." to print to stdout)',
        default(answers: any) {
          return resolve(`.${moduleName}rc.${answers.format as string}`);
        },
      },
      {
        type: "input",
        name: "aliases",
        message:
          "Enter file path to existing table aliases file, or directory path to create a new one (optional)",
      },
    ];

    // Extract path and format as we don't include them in the config file
    const response = await inquirer.prompt(questions, answers);
    output = Object.fromEntries(
      Object.entries(response).filter(([_, v]) => !!(v as boolean))
    ) as any;
  } else {
    output = { ...defaults, ...answers };
  }
  // Create the config file
  const { path, format, aliases, ...rest } = output;
  const configFilePath = resolve(path ?? `.${moduleName}rc`);
  // Make sure the table aliases file or provided directory exists
  if (aliases != null) {
    try {
      rest.aliases = findOrCreateAliasesFile(aliases);
    } catch (err: any) {
      logger.error(err.message); // exit early since the input was invalid
      return;
    }
  }
  let stream = process.stdout as unknown as WriteStream;
  if (path !== ".") {
    mkdirSync(dirname(configFilePath), { recursive: true });
    stream = createWriteStream(configFilePath, "utf-8");
  }
  try {
    switch (format) {
      case "json":
        stream.write(JSON.stringify(rest, null, "  "));
        break;
      case "yaml":
      case "yml":
      default:
        stream.write(yaml.dump(rest));
        break;
    }
    if (path !== ".") {
      logger.log(`Config created at ${configFilePath}`);
    }
  } catch (err: any) {
    logger.error(err.message);
    return;
  } finally {
    stream.end("\n");
  }
};
