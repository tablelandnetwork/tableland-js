#!/usr/bin/env node

import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { LocalTableland } from "./main.js";
import { getConfigFile, Config } from "./util.js";
import { projectBuilder } from "./project-builder.js";

const argv = yargs(hideBin(process.argv)).options({
  validator: {
    type: "string",
    description: "Path the the Tableland Validator repository",
  },
  registry: {
    type: "string",
    default: "",
    description: "Path the the Tableland Registry contract repository",
  },
  verbose: {
    type: "boolean",
    default: false,
    description: "Output verbose logs to stdout",
  },
  silent: {
    type: "boolean",
    default: false,
    description: "Silence all output to stdout",
  },
  upgrade: {
    type: "boolean",
    default: false,
    alias: "u",
    description:
      "Update your Validator and Registry repositories.\n" +
      "If your Validator or Registry is located outside\n" +
      "this project this command will not do anything.",
  },
}).argv;

const go = async function () {
  // using these argv ts ignores for the reasons explained in the yargs readme.
  // https://github.com/yargs/yargs/blob/main/docs/typescript.md#typescript-usage-examples
  // TODO: try `parseSync`

  // @ts-ignore
  const argvValidator = argv.validator;
  // @ts-ignore
  const argvRegistry = argv.registry;

  const configFile = await getConfigFile();
  const hasValidatorDir = configFile.validatorDir || argvValidator;
  if (!hasValidatorDir) {
    // If these aren't specified then we want to open a terminal prompt that
    // will help the user setup their project directory then exit when finished
    await projectBuilder();
    return;
  }

  const opts: Config = {
    validator: argvValidator,
    registry: argvRegistry,
    // @ts-ignore
    verbose: argv.verbose,
    // @ts-ignore
    silent: argv.silent,
  };

  const tableland = new LocalTableland(opts);

  process.on("SIGINT", async () => await tableland.shutdown());

  await tableland.start();
};

// start a tableland network, then catch any uncaught errors and exit loudly
go().catch((err) => {
  console.error("unrecoverable error");
  console.error(err);

  // eslint-disable-next-line no-process-exit
  process.exit();
});
