import { describe, test, afterEach, before } from "mocha";
import { spy, restore, assert } from "sinon";
import yargs from "yargs/yargs";
import * as mod from "../src/commands/chains.js";
import { SUPPORTED_CHAINS } from "@tableland/sdk";

describe("commands/chains", function () {
  before(async function () {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(function () {
    restore();
  });

  test("returns correct output", async function () {
    const chains = Object.fromEntries(
      Object.entries(SUPPORTED_CHAINS).filter(
        ([name]) => !name.includes("staging") && !name.includes("custom")
      )
    );
    const out = JSON.stringify(chains, null, 2);
    const consoleLog = spy(console, "log");
    await yargs(["chains"]).command(mod).parse();
    assert.calledWith(consoleLog, out);
  });
});
