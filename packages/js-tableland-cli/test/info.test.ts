import { equal } from "node:assert";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore, assert } from "sinon";
import yargs from "yargs/yargs";
import * as mod from "../src/commands/info.js";
import { wait } from "../src/utils.js";

describe("commands/info", function () {
  this.timeout("30s");

  before(async function () {
    await wait(10000);
  });

  afterEach(function () {
    restore();
  });

  test("info throws with invalid table name", async function () {
    const consoleError = spy(console, "error");
    await yargs(["info", "invalid_name"]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "invalid table name (name format is `{prefix}_{chainId}_{tableId}`)"
    );
  });

  test("info throws with invalid chain", async function () {
    const consoleError = spy(console, "error");
    await yargs(["info", "valid_9999_0"]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "unsupported chain (see `chains` command for details)"
    );
  });

  test("Info passes with local-tableland", async function () {
    const consoleLog = spy(console, "log");
    await yargs(["info", "healthbot_31337_1"]).command(mod).parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { name, attributes, externalUrl } = value;

    equal(name, "healthbot_31337_1");
    equal(externalUrl, "http://localhost:8080/api/v1/tables/31337/1");
    equal(Array.isArray(attributes), true);
  });

  test("info throws with missing table", async function () {
    const consoleError = spy(console, "error");
    await yargs(["info", "ignored_31337_99"]).command(mod).parse();
    assert.calledWith(consoleError, "Not Found");
  });
});
