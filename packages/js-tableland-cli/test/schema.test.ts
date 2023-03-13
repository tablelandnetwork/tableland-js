import { describe, test, afterEach, before } from "mocha";
import { spy, restore, assert } from "sinon";
import yargs from "yargs/yargs";
import * as mod from "../src/commands/schema.js";

describe("commands/schema", function () {
  before(async function () {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(function () {
    restore();
  });

  test("throws without invalid table name", async function () {
    const consoleError = spy(console, "error");
    await yargs(["schema", "invalid_name"]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "invalid table name (name format is `{prefix}_{chainId}_{tableId}`)"
    );
  });

  test("throws with invalid chain", async function () {
    const consoleError = spy(console, "error");
    await yargs(["schema", "valid_9999_0"]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "unsupported chain (see `chains` command for details)"
    );
  });

  test("throws with missing table", async function () {
    const consoleError = spy(console, "error");
    await yargs(["schema", "ignored_31337_99"]).command(mod).parse();
    assert.calledWith(consoleError, "Not Found");
  });

  test("Schema passes with local-tableland", async function () {
    const consoleLog = spy(console, "log");
    await yargs(["schema", "healthbot_31337_1"]).command(mod).parse();
    assert.calledWith(
      consoleLog,
      `{"columns":[{"name":"counter","type":"integer"}]}`
    );
  });
});
