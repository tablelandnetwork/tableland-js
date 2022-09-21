#!/usr/bin/env node

import * as dotenv from "dotenv";
import fetch, { Headers, Request, Response } from "node-fetch";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { commands } from "./commands/index.js";

if (!globalThis.fetch) {
  (globalThis as any).fetch = fetch;
  (globalThis as any).Headers = Headers;
  (globalThis as any).Request = Request;
  (globalThis as any).Response = Response;
}

// If a dotenv file (or exported env vars) are provided, these override any config values
dotenv.config();

// eslint-disable-next-line no-unused-vars
const _ = yargs(hideBin(process.argv))
  // .commandDir("commands")
  .command(commands as any)
  .env("TBL")
  .option("k", {
    alias: "privateKey",
    type: "string",
    description: "Private key string",
  })
  .option("c", {
    alias: "chain",
    type: "string",
    description: "The EVM chain to target",
    default: "polygon-mumbai",
  })
  .option("r", {
    alias: "rpcRelay",
    type: "boolean",
    description: "Whether writes should be relayed via a validator",
  })
  .options({
    alchemy: {
      type: "string",
      description: "Alchemy provider API key",
    },
    infura: {
      type: "string",
      description: "Infura provider API key",
    },
    etherscan: {
      type: "string",
      description: "Etherscan provider API key",
    },
  })
  .demandCommand(1, "")
  .strict().argv;
