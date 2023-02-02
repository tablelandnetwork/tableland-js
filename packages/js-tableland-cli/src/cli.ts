#!/usr/bin/env node --experimental-specifier-resolution=node

import * as dotenv from "dotenv";
import fetch, { Headers, Request, Response } from "node-fetch";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { commands } from "./commands/index.js";
import { cosmiconfigSync } from "cosmiconfig";
import { helpers } from "@tableland/sdk";

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
  chain: helpers.ChainName;
  providerUrl: string;
  baseUrl: string;
  verbose: boolean;
  ensProviderUrl?: string;
  enableEnsExperiment?: boolean;
}

// eslint-disable-next-line no-unused-vars
const _argv = yargs(hideBin(process.argv))
  .parserConfiguration({
    "strip-aliased": true,
    "strip-dashed": true,
    "camel-case-expansion": true,
  })
  .command(commands as any)
  .env("TBL")
  .config(config?.config)
  .option("privateKey", {
    alias: "k",
    type: "string",
    description: "Private key string",
  })
  .option("chain", {
    alias: "c",
    type: "string",
    description: "The EVM chain to target",
    default: "maticmum",
  })
  .option("enableEnsExperiment", {
    type: "boolean",
    description: "Enable ENS experiment",
  })
  .option("ensProviderUrl", {
    type: "string",
    description: "Enable ENS experiment",
  })
  .option("baseUrl", {
    type: "string",
    description: "The URL of your Tableland validator",
  })
  .options("providerUrl", {
    alias: "p",
    type: "string",
    description:
      "JSON RPC API provider URL. (e.g., https://eth-rinkeby.alchemyapi.io/v2/123abc123a...)",
  })
  .demandCommand(1, "")
  .strict().argv;
