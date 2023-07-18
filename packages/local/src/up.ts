#!/usr/bin/env node

import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { LocalTableland } from "./main.js";
import { Config } from "./util.js";
import { projectBuilder } from "./project-builder.js";

const argv = yargs(hideBin(process.argv)).options({
  validator: {
    type: "string",
    description:
      "Path the the Tableland Validator directory.  If docker flag is set this must be the full repository.",
  },
  registry: {
    type: "string",
    description: "Path the the Tableland Registry contract repository.",
  },
  docker: {
    type: "boolean",
    default: false,
    description: "Use Docker to run the Validator.",
  },
  verbose: {
    type: "boolean",
    description: "Output verbose logs to stdout.",
  },
  silent: {
    type: "boolean",
    description: "Silence all output to stdout.",
  },
  init: {
    type: "boolean",
    default: false,
    description: "Initialize a local tableland config file.",
  },
}).argv;

const go = async function () {
  // casting argv to `any` for the reasons explained in the yargs readme.
  // https://github.com/yargs/yargs/blob/main/docs/typescript.md#typescript-usage-examples
  // TODO: try `parseSync`
  const tsArgv = argv as any;
  if (tsArgv.init) {
    // If init arg is given we want to open a terminal prompt that will
    // help the user setup their project directory then exit when finished
    await projectBuilder();
    return;
  }

  const opts: Config = {};

  if (tsArgv.validator) opts.validator = tsArgv.validator;
  if (tsArgv.registry) opts.registry = tsArgv.registry;
  if (tsArgv.docker) opts.docker = tsArgv.docker;
  if (typeof tsArgv.verbose === "boolean") opts.verbose = tsArgv.verbose;
  if (typeof tsArgv.silent === "boolean") opts.silent = tsArgv.silent;

  const tableland = new LocalTableland(opts);

  process.on("SIGINT", async () => {
    console.log("got SIGINT, killing...");
    await tableland.shutdown();
  });

  await tableland.start();
};

// start a tableland network, then catch any uncaught errors and exit loudly
go().catch((err) => {
  console.error("unrecoverable error");
  console.error(err);

  // eslint-disable-next-line no-process-exit
  process.exit();
});
