#!/usr/bin/env node

import * as dotenv from "dotenv";
import fetch, { Headers, Request, Response } from "node-fetch";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { cosmiconfigSync } from "cosmiconfig";
import { type helpers } from "@tableland/sdk";
import { commands } from "./commands/index.js";

process.on("warning", (warning) => {
  if (warning.name !== "ExperimentalWarning") {
    console.warn(warning.name, warning.message);
  }
});

// eslint-disable-next-line
if (!globalThis.fetch) {
  (globalThis as any).fetch = fetch;
  (globalThis as any).Headers = Headers;
  (globalThis as any).Request = Request;
  (globalThis as any).Response = Response;
}

// By default, check these places for an rc config
const moduleName = "tableland";
const explorer = cosmiconfigSync(moduleName, {
  searchPlaces: [
    `.${moduleName}rc.yaml`,
    `.${moduleName}rc.yml`,
    `.${moduleName}rc.json`,
    `.${moduleName}rc`, // Can be yaml or json
    "package.json", // For the ts/js devs in the house
  ],
});
const config = explorer.search();

// If a dotenv file (or exported env vars) are provided, these override any config values
dotenv.config();

export interface GlobalOptions {
  privateKey: string;
  chain: helpers.ChainName | number;
  providerUrl: string;
  baseUrl: string;
  verbose: boolean;
  ensProviderUrl?: string;
  enableEnsExperiment?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _argv = yargs(hideBin(process.argv))
  .parserConfiguration({
    "strip-aliased": true,
    "strip-dashed": true,
    "camel-case-expansion": true,
  })
  .command(commands as any)
  .env("TBL")
  .config(config?.config)
  // the help and version options are internal to yargs, hence they are
  // at the top of the help message no matter what order we specifiy
  .option("help", {
    alias: "h",
  })
  .alias("version", "V")
  // custom options are in alphabetical order
  .option("baseUrl", {
    type: "string",
    description: "The URL of your Tableland validator",
  })
  .option("chain", {
    alias: "c",
    type: "string",
    description: "The EVM chain to target",
  })
  .option("enableEnsExperiment", {
    type: "boolean",
    description: "Enable ENS experiment",
  })
  .option("ensProviderUrl", {
    type: "string",
    description: "Enable ENS experiment",
  })
  .option("privateKey", {
    alias: "k",
    type: "string",
    description: "Private key string",
  })
  .option("providerUrl", {
    alias: "p",
    type: "string",
    description:
      "JSON RPC API provider URL. (e.g., https://eth-rinkeby.alchemyapi.io/v2/123abc123a...)",
  })
  .demandCommand(1, "")
  .strict().argv;
