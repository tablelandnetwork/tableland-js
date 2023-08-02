import { equal } from "node:assert";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore } from "sinon";
import yargs from "yargs/yargs";
import * as mod from "../src/commands/schema.js";
import { wait, logger } from "../src/utils.js";

describe("commands/schema", function () {
  before(async function () {
    await wait(1000);
  });

  afterEach(function () {
    restore();
  });

  test("throws without invalid table name", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["schema", "invalid_name"]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(
      value,
      "invalid table name (name format is `{prefix}_{chainId}_{tableId}`)"
    );
  });

  test("throws with invalid chain", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["schema", "valid_9999_0"]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "unsupported chain (see `chains` command for details)");
  });

  test("throws with missing table", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["schema", "ignored_31337_99"]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "Not Found");
  });

  test("Schema passes with local-tableland", async function () {
    const consoleLog = spy(logger, "log");
    await yargs(["schema", "healthbot_31337_1"]).command(mod).parse();

    const value = consoleLog.getCall(0).firstArg;
    equal(value, `{"columns":[{"name":"counter","type":"integer"}]}`);
  });
});
