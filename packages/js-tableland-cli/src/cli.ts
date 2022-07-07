#!/usr/bin/env node

import fetch, { Headers, Request, Response } from "node-fetch";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

if (!globalThis.fetch) {
  (globalThis as any).fetch = fetch;
  (globalThis as any).Headers = Headers;
  (globalThis as any).Request = Request;
  (globalThis as any).Response = Response;
}

// eslint-disable-next-line no-unused-vars
const _ = yargs(hideBin(process.argv))
  .commandDir("commands")
  .env("TBL")
  .option("k", {
    alias: "privateKey",
    type: "string",
    description: "Private key string",
  })
  .option("h", {
    alias: "host",
    type: "string",
    description:
      "Remote API host (e.g. https://{testnet}.tableland.network)",
    default: "https://testnet.tableland.network",
  })
  .option("chain", {
    type: "string",
    description: "The EVM compatible chain to target",
    default: "ethereum-goerli",
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
  .option("t", {
    alias: "token",
    type: "string",
    description: "Signed SIWE token (see `token --help`)",
  })

  .strict().argv;
