import { equal } from "node:assert";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore } from "sinon";
import yargs from "yargs/yargs";
import * as mod from "../src/commands/info.js";
import { wait, logger } from "../src/utils.js";
import { TEST_TIMEOUT_FACTOR, TEST_PROVIDER_URL } from "./setup";

const defaultArgs = ["--providerUrl", TEST_PROVIDER_URL];

describe("commands/info", function () {
  this.timeout(30000 * TEST_TIMEOUT_FACTOR);

  before(async function () {
    await wait(10000);
  });

  afterEach(function () {
    restore();
  });

  test("info throws with invalid table name", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["info", "invalid_name", ...defaultArgs])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(
      value,
      "invalid table name (name format is `{prefix}_{chainId}_{tableId}`)"
    );
  });

  test("info throws with invalid chain", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["info", "valid_9999_0", ...defaultArgs])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "unsupported chain (see `chains` command for details)");
  });

  test("Info passes with local-tableland", async function () {
    const consoleLog = spy(logger, "log");
    await yargs(["info", "healthbot_31337_1", ...defaultArgs])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { name, attributes, externalUrl } = value;

    equal(name, "healthbot_31337_1");
    equal(externalUrl, "http://localhost:8082/api/v1/tables/31337/1");
    equal(Array.isArray(attributes), true);
  });

  test("info throws with missing table", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["info", "ignored_31337_99", ...defaultArgs])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "Not Found");
  });
});
