import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import yaml from "js-yaml";
import { resolve, dirname } from "path";
import { mkdirSync, createWriteStream, WriteStream } from "fs";
import inquirer from "inquirer";
import { getChains } from "../utils.js";

export type Options = {
  // Local
  yes: boolean;
  format: "json" | "yaml" | "yml";
  path: string;
};

const defaults = {
  chain: "polygon-mumbai",
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
          return resolve(`.${moduleName}rc.${answers.format}`);
        },
      },
    ];

    // Extract path and format as we don't include them in the config file
    const response = await inquirer.prompt(questions, answers);
    output = Object.fromEntries(
      Object.entries(response).filter(([_, v]) => !!v)
    ) as any;
  } else {
    output = { ...defaults, ...answers };
  }
  const { path, format, ...rest } = output;
  const filePath = resolve(path || `.${moduleName}rc`);
  let stream = process.stdout as unknown as WriteStream;
  if (path !== ".") {
    mkdirSync(dirname(filePath), { recursive: true });
    stream = createWriteStream(filePath, "utf-8") as WriteStream;
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
      console.log(`Config created at ${filePath}`);
    }
  } catch (err: any) {
    console.error(err.message);
    return;
  } finally {
    stream.end("\n");
  }
};
