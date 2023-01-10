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

  test("chains returns correct output", async function () {
    const chains = getChains();
    const consoleLog = spy(console, "log");
    await yargs(["chains"]).command(mod).parse();
    assert.calledWith(consoleLog, chains);
  });
});
