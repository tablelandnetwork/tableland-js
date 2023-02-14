import { describe, test, afterEach, before } from "mocha";
import { spy, restore, assert, match } from "sinon";
import yargs from "yargs/yargs";
import { getAccounts } from "@tableland/local";
import * as mod from "../src/commands/controller.js";
import { wait } from "../src/utils.js";

describe("commands/controller", function () {
  this.timeout("30s");

  before(async function () {
    await wait(500);
  });

  afterEach(function () {
    restore();
  });

  test("throws without privateKey", async function () {
    const consoleError = spy(console, "error");
    await yargs(["controller", "get", "blah"]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "missing required flag (`-k` or `--privateKey`)"
    );
  });

  test("throws with invalid chain", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(console, "error");
    await yargs([
      "controller",
      "set",
      "someting",
      "another",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleError,
      "unsupported chain (see `chains` command for details)"
    );
  });

  test("throws with invalid get argument", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(console, "error");
    await yargs([
      "controller",
      "get",
      "invalid",
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
    ])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleError,
      "error validating name: table name has wrong format: invalid"
    );
  });

  test("throws with invalid set arguments", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(console, "error");
    await yargs([
      "controller",
      "set",
      "invalid",
      "",
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
    ])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleError,
      "error validating name: table name has wrong format: "
    );
  });

  test("passes when setting a controller", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleDir = spy(console, "dir");

    await yargs([
      "controller",
      "set",
      "0x0000000000000000000000000000000000000000",
      "healthbot_31337_1",
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
    ])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleDir,
      match(function (value: any) {
        const { hash, link } = value;
        return typeof hash === "string" && hash.startsWith("0x") && !link;
      }, "does not match")
    );
  });

  test("passes when getting a controller", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleDir = spy(console, "dir");
    await yargs([
      "controller",
      "get",
      "healthbot_31337_1",
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
    ])
      .command(mod)
      .parse();
    assert.calledWith(consoleDir, `0x0000000000000000000000000000000000000000`);
  });

  // TODO: Create tests for locking a controller
});
