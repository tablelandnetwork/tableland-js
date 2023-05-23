import { describe, test, afterEach, before } from "mocha";
import { spy, restore, assert } from "sinon";
import yargs from "yargs/yargs";
import * as mod from "../src/commands/chains.js";
import { getChains } from "../src/utils.js";

describe("commands/chains", function () {
  before(async function () {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(function () {
    restore();
  });

  test("chains defaults to json output", async function () {
    const chains = getChains();
    const consoleLog = spy(console, "log");
    await yargs(["chains"]).command(mod).parse();
    assert.calledWith(consoleLog, JSON.stringify(chains));
  });

  test("chains returns json output", async function () {
    const chains = getChains();
    const consoleLog = spy(console, "log");
    await yargs(["chains", "--format=json"]).command(mod).parse();
    assert.calledWith(consoleLog, JSON.stringify(chains));
  });

  test("chains format returns readable output", async function () {
    const chains = getChains();
    const consoleLog = spy(console, "log");
    await yargs(["chains", "--format=pretty"]).command(mod).parse();
    assert.calledWith(consoleLog, JSON.stringify(chains, null, 4));
  });

  test("chains format returns jsonl output", async function () {
    const chains = getChains();
    const consoleLog = spy(console, "log");
    await yargs(["chains", "--format=jsonl"]).command(mod).parse();
    assert.calledWith(
      consoleLog,
      Object.entries(chains)
        .map((chain) => JSON.stringify(chain[1]))
        .join("\n")
    );
  });
});
