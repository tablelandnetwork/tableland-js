import { describe, test, afterEach, before } from "mocha";
import { spy, restore, assert, match } from "sinon";
import yargs from "yargs/yargs";
import * as mod from "../src/commands/info.js";

describe("commands/info", function () {
  before(async function () {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(function () {
    restore();
  });

  test("throws with invalid table name", async function () {
    const consoleError = spy(console, "error");
    await yargs(["info", "invalid_name"]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "invalid table name (name format is `{prefix}_{chainId}_{tableId}`)"
    );
  });

  test("throws with invalid chain", async function () {
    const consoleError = spy(console, "error");
    await yargs(["info", "valid_9999_0"]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "unsupported chain (see `chains` command for details)"
    );
  });

  test("throws with missing table", async function () {
    const consoleError = spy(console, "error");
    await yargs(["info", "ignored_31337_99"]).command(mod).parse();
    assert.calledWith(consoleError, "Table not found");
  });

  test("passes with local-tableland", async function () {
    const consoleLog = spy(console, "log");
    await yargs(["info", "healthbot_31337_1"]).command(mod).parse();
    assert.calledWith(
      consoleLog,
      match(function (value: string) {
        // eslint-disable-next-line camelcase
        const { name, attributes, external_url } = JSON.parse(value);
        return (
          name === "healthbot_31337_1" &&
          // eslint-disable-next-line camelcase
          external_url === "http://localhost:8080/chain/31337/tables/1" &&
          Array.isArray(attributes)
        );
      }, "does not match")
    );
  });
});
