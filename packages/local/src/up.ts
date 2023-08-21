#!/usr/bin/env node

import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { LocalTableland } from "./main.js";
import { type Config } from "./util.js";
import { projectBuilder } from "./project-builder.js";

const argv = yargs(hideBin(process.argv)).options({
  validator: {
    type: "string",
    description:
      "Path the the Tableland Validator directory. If docker flag is set, this must be the full repository.",
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
  // note: if a new Registry port is used, clients (SDK, CLI, etc.) that expect port
  // 8545 will not work unless the RPC is explicity passed with this port—but, tests
  // w/ Local Tableland can retrieve it with `getRegistryPort(lt)` and run as intended.
  registryPort: {
    type: "number",
    description: "Use a custom Registry port for hardhat.",
  },
  init: {
    type: "boolean",
    default: false,
    description: "Initialize a local tableland config file.",
  },
}).argv;

const go = async function (): Promise<void> {
  // casting argv to `any` for the reasons explained in the yargs readme.
  // https://github.com/yargs/yargs/blob/main/docs/typescript.md#typescript-usage-examples
  // TODO: try `parseSync`
  const tsArgv = argv as any;
  if (tsArgv.init as boolean) {
    // If init arg is given we want to open a terminal prompt that will
    // help the user setup their project directory then exit when finished
    await projectBuilder();
    return;
  }

  const opts: Config = {};

  if (tsArgv.validator != null && tsArgv.validator !== "") {
    opts.validator = tsArgv.validator;
  }
  if (tsArgv.registry != null && tsArgv.registry !== "") {
    opts.registry = tsArgv.registry;
  }
  if (tsArgv.docker as boolean) opts.docker = tsArgv.docker;
  if (typeof tsArgv.verbose === "boolean") opts.verbose = tsArgv.verbose;
  if (typeof tsArgv.silent === "boolean") opts.silent = tsArgv.silent;
  if (typeof tsArgv.registryPort === "number")
    opts.registryPort = tsArgv.registryPort;

  const tableland = new LocalTableland(opts);

  // typescript eslint is complaining here becasue the Promise returned from this handler
  // isn't be handled this seems ok to me since the entire process is being killed anyway
  // eslint-disable-next-line
  process.on("SIGINT", async () => {
    console.log("got SIGINT, killing...");
    await tableland.shutdown();
  });

  await tableland.start();
};

// start a tableland network, then catch any uncaught errors and exit loudly
go().catch((err) => {
  if (err.message.includes(`port already in use`) as boolean) {
    console.error(err);
  } else {
    console.error("unrecoverable error");
    console.error(err);
  }

  // eslint-disable-next-line no-process-exit
  process.exit();
});
