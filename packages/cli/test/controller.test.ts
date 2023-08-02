import { equal, match } from "node:assert";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore } from "sinon";
import yargs from "yargs/yargs";
import { getAccounts, getDatabase } from "@tableland/local";
import * as mod from "../src/commands/controller.js";
import { wait, logger } from "../src/utils.js";

describe("commands/controller", function () {
  this.timeout("30s");

  // account[0] is the Validator's wallet, try to avoid using that
  const accounts = getAccounts();
  const db = getDatabase(accounts[1]);

  let tableName: string;
  before(async function () {
    await wait(500);
    const { meta } = await db
      .prepare("CREATE TABLE test_controller (a int);")
      .all();
    tableName = meta.txn?.name ?? "";
  });

  afterEach(function () {
    restore();
  });

  test("throws without privateKey", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["controller", "get", "blah"]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "missing required flag (`-k` or `--privateKey`)");
  });

  test("throws with invalid chain", async function () {
    const privateKey = accounts[1].privateKey.slice(2);
    const consoleError = spy(logger, "error");
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

    const value = consoleError.getCall(0).firstArg;
    equal(value, "unsupported chain (see `chains` command for details)");
  });

  test("throws with invalid get argument", async function () {
    const privateKey = accounts[1].privateKey.slice(2);
    const consoleError = spy(logger, "error");
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

    const value = consoleError.getCall(0).firstArg;
    equal(value, "error validating name: table name has wrong format: invalid");
  });

  test("throws with invalid set arguments", async function () {
    const privateKey = accounts[1].privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "controller",
      "set",
      "invalid",
      "invalid",
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    match(value, /error validating name: table name has wrong format:/);
  });

  test("passes when setting a controller", async function () {
    const privateKey = accounts[1].privateKey.slice(2);
    const consoleLog = spy(logger, "log");

    await yargs([
      "controller",
      "set",
      accounts[2].address,
      tableName,
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const { hash, link } = JSON.parse(res);
    equal(typeof hash, "string");
    equal(hash.startsWith("0x"), true);
    equal(link, "");
  });

  test("passes when getting a controller", async function () {
    const privateKey = accounts[1].privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    await yargs([
      "controller",
      "get",
      tableName,
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
    ])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(0).firstArg;
    equal(value, accounts[2].address);
  });

  test("passes when locking a controller", async function () {
    const privateKey = accounts[1].privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    await yargs([
      "controller",
      "lock",
      tableName,
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);

    equal(value.hash.startsWith("0x"), true);
    equal(value.from, accounts[1].address);
  });
});
