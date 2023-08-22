import { equal, match } from "node:assert";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore } from "sinon";
import yargs from "yargs/yargs";
import { getAccounts, getDatabase } from "@tableland/local";
import { helpers, Database } from "@tableland/sdk";
import { temporaryWrite } from "tempy";
import * as mod from "../src/commands/controller.js";
import { jsonFileAliases, logger, wait } from "../src/utils.js";

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
      "something",
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

  test("throws with invalid lock arguments", async function () {
    const privateKey = accounts[1].privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "controller",
      "lock",
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

  describe("with table aliases", function () {
    test("throws with invalid get arguments", async function () {
      const [account] = accounts;
      const privateKey = account.privateKey.slice(2);
      const aliasesFilePath = await temporaryWrite(`{}`, {
        extension: "json",
      });

      const consoleError = spy(logger, "error");
      await yargs([
        "controller",
        "get",
        "invalid",
        "--privateKey",
        privateKey,
        "--chain",
        "local-tableland",
        "--aliases",
        aliasesFilePath,
      ])
        .command(mod)
        .parse();

      const value = consoleError.getCall(0).firstArg;
      match(value, /error validating name: table name has wrong format:/);
    });

    test("throws with invalid set arguments", async function () {
      const [account] = accounts;
      const privateKey = account.privateKey.slice(2);
      const aliasesFilePath = await temporaryWrite(`{}`, {
        extension: "json",
      });

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
        "--aliases",
        aliasesFilePath,
      ])
        .command(mod)
        .parse();

      const value = consoleError.getCall(0).firstArg;
      match(value, /error validating name: table name has wrong format:/);
    });

    test("throws with invalid lock arguments", async function () {
      const [account] = accounts;
      const privateKey = account.privateKey.slice(2);
      const aliasesFilePath = await temporaryWrite(`{}`, {
        extension: "json",
      });

      const consoleError = spy(logger, "error");
      await yargs([
        "controller",
        "lock",
        "invalid",
        "--privateKey",
        privateKey,
        "--chain",
        "local-tableland",
        "--aliases",
        aliasesFilePath,
      ])
        .command(mod)
        .parse();

      const value = consoleError.getCall(0).firstArg;
      match(value, /error validating name: table name has wrong format:/);
    });

    test("passes when setting a controller", async function () {
      const [account] = accounts;
      const privateKey = account.privateKey.slice(2);
      // Set up test aliases file
      const aliasesFilePath = await temporaryWrite(`{}`, {
        extension: "json",
      });
      // Create new db instance to enable aliases
      const db = new Database({
        signer: account,
        baseUrl: helpers.getBaseUrl("local-tableland"),
        autoWait: true,
        aliases: jsonFileAliases(aliasesFilePath),
      });
      const { meta } = await db
        .prepare("CREATE TABLE table_aliases (id int);")
        .all();
      const nameFromCreate = meta.txn?.name ?? "";
      const prefix = meta.txn?.prefix ?? "";

      // Check the aliases file was updated and matches with the prefix
      const nameMap = await jsonFileAliases(aliasesFilePath).read();
      const tableAlias =
        Object.keys(nameMap).find(
          (alias) => nameMap[alias] === nameFromCreate
        ) ?? "";
      equal(tableAlias, prefix);

      // Now, set the controller
      const consoleLog = spy(logger, "log");
      await yargs([
        "controller",
        "set",
        accounts[2].address,
        tableAlias,
        "--privateKey",
        privateKey,
        "--chain",
        "local-tableland",
        "--aliases",
        aliasesFilePath,
      ])
        .command(mod)
        .parse();

      const res = consoleLog.getCall(0).firstArg;
      const { hash, link } = JSON.parse(res);
      equal(typeof hash, "string");
      equal(hash.startsWith("0x"), true);
      equal(link != null, true);
    });

    test("passes when getting a controller", async function () {
      const [account] = accounts;
      const privateKey = account.privateKey.slice(2);
      // Set up test aliases file
      const aliasesFilePath = await temporaryWrite(`{}`, {
        extension: "json",
      });
      // Create new db instance to enable aliases
      const db = new Database({
        signer: account,
        baseUrl: helpers.getBaseUrl("local-tableland"),
        autoWait: true,
        aliases: jsonFileAliases(aliasesFilePath),
      });
      const { meta } = await db
        .prepare("CREATE TABLE table_aliases (id int);")
        .all();
      const nameFromCreate = meta.txn?.name ?? "";
      const prefix = meta.txn?.prefix ?? "";

      // Check the aliases file was updated and matches with the prefix
      const nameMap = await jsonFileAliases(aliasesFilePath).read();
      const tableAlias =
        Object.keys(nameMap).find(
          (alias) => nameMap[alias] === nameFromCreate
        ) ?? "";
      equal(tableAlias, prefix);

      // Now, get the controller
      const consoleLog = spy(logger, "log");
      await yargs([
        "controller",
        "get",
        tableAlias,
        "--privateKey",
        privateKey,
        "--chain",
        "local-tableland",
        "--aliases",
        aliasesFilePath,
      ])
        .command(mod)
        .parse();

      const value = consoleLog.getCall(0).firstArg;
      equal(value, "0x0000000000000000000000000000000000000000");
    });

    test("passes when locking a controller", async function () {
      const [account] = accounts;
      const privateKey = account.privateKey.slice(2);
      // Set up test aliases file
      const aliasesFilePath = await temporaryWrite(`{}`, {
        extension: "json",
      });
      // Create new db instance to enable aliases
      const db = new Database({
        signer: account,
        baseUrl: helpers.getBaseUrl("local-tableland"),
        autoWait: true,
        aliases: jsonFileAliases(aliasesFilePath),
      });
      const { meta } = await db
        .prepare("CREATE TABLE table_aliases (id int);")
        .all();
      const nameFromCreate = meta.txn?.name ?? "";
      const prefix = meta.txn?.prefix ?? "";

      // Check the aliases file was updated and matches with the prefix
      const nameMap = await jsonFileAliases(aliasesFilePath).read();
      const tableAlias =
        Object.keys(nameMap).find(
          (alias) => nameMap[alias] === nameFromCreate
        ) ?? "";
      equal(tableAlias, prefix);

      // Now, lock the controller
      const consoleLog = spy(logger, "log");
      await yargs([
        "controller",
        "lock",
        tableAlias,
        "--privateKey",
        privateKey,
        "--chain",
        "local-tableland",
        "--aliases",
        aliasesFilePath,
      ])
        .command(mod)
        .parse();

      const res = consoleLog.getCall(0).firstArg;
      const value = JSON.parse(res);

      equal(value.hash.startsWith("0x"), true);
      equal(value.from, account.address);
    });
  });
});
