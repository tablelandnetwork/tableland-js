#!/usr/bin/env node

import fetch, { Headers, Request, Response } from "node-fetch";

if (!globalThis.fetch) {
  (globalThis as any).fetch = fetch;
  (globalThis as any).Headers = Headers;
  (globalThis as any).Request = Request;
  (globalThis as any).Response = Response;
}

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// Useful aliases.
yargs(hideBin(process.argv))
  // Use the commands directory to scaffold.
  .commandDir("commands")
  .env("TBL")
  .option("k", {
    alias: "privateKey",
    demandOption: true,
    type: "string",
    description: "Private key string",
  })
  .option("h", {
    alias: "host",
    type: "string",
    description: "Remote API host",
    default: "https://testnet.tableland.network",
  })
  .option("network", {
    type: "string",
    description: "The EVM compatible network to target (currently ignored)",
    default: "rinkeby",
  })
  .strict().argv;
