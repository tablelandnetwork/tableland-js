import { equal, match } from "node:assert";
import { getDefaultProvider } from "ethers";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore } from "sinon";
import yargs from "yargs/yargs";
import { Database } from "@tableland/sdk";
import { getAccounts } from "@tableland/local";
import { jsonFileAliases } from "@tableland/node-helpers";
import { temporaryWrite } from "tempy";
import * as mod from "../src/commands/controller.js";
import { logger, wait } from "../src/utils.js";
import {
  TEST_TIMEOUT_FACTOR,
  TEST_PROVIDER_URL,
  TEST_VALIDATOR_URL,
} from "./setup";

const defaultArgs = [
  "--providerUrl",
  TEST_PROVIDER_URL,
  "--baseUrl",
  TEST_VALIDATOR_URL,
  "--chain",
  "local-tableland",
];

const accounts = getAccounts();
const wallet = accounts[1];
const provider = getDefaultProvider(TEST_PROVIDER_URL, { chainId: 31337 });
const signer = wallet.connect(provider);
const db = new Database({ signer, autoWait: true });

describe("commands/controller", function () {
  this.timeout(30000 * TEST_TIMEOUT_FACTOR);

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
    await yargs(["controller", "get", "blah", ...defaultArgs])
      .command(mod)
      .parse();

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
      "--providerUrl",
      TEST_PROVIDER_URL,
      "--chain",
      "fooz",
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
      ...defaultArgs,
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
      ...defaultArgs,
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
      ...defaultArgs,
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
      ...defaultArgs,
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
      ...defaultArgs,
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
      ...defaultArgs,
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
      const account = accounts[1];
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
        ...defaultArgs,
        "--aliases",
        aliasesFilePath,
      ])
        .command(mod)
        .parse();

      const value = consoleError.getCall(0).firstArg;
      match(value, /error validating name: table name has wrong format:/);
    });

    test("throws with invalid set arguments", async function () {
      const account = accounts[1];
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
        ...defaultArgs,
        "--aliases",
        aliasesFilePath,
      ])
        .command(mod)
        .parse();

      const value = consoleError.getCall(0).firstArg;
      match(value, /error validating name: table name has wrong format:/);
    });

    test("throws with invalid lock arguments", async function () {
      const account = accounts[1];
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
        ...defaultArgs,
        "--aliases",
        aliasesFilePath,
      ])
        .command(mod)
        .parse();

      const value = consoleError.getCall(0).firstArg;
      match(value, /error validating name: table name has wrong format:/);
    });

    test("passes when setting a controller", async function () {
      // Set up test aliases file
      const aliasesFilePath = await temporaryWrite(`{}`, {
        extension: "json",
      });
      // Create new db instance to enable aliases
      const db = new Database({
        signer,
        autoWait: true,
        aliases: jsonFileAliases(aliasesFilePath),
      });

      const { meta } = await db
        .prepare("CREATE TABLE table_aliases (id int);")
        .all();
      const nameFromCreate = meta.txn?.name ?? "";
      const prefix = meta.txn?.prefix ?? "";

      // Check the aliases file was updated and matches with the prefix
      const nameMap = jsonFileAliases(aliasesFilePath).read();
      const tableAlias =
        Object.keys(nameMap).find(
          (alias) => nameMap[alias] === nameFromCreate
        ) ?? "";
      equal(tableAlias, prefix);

      const account1 = accounts[1];
      const account2 = accounts[2];

      // Now, set the controller
      const consoleLog = spy(logger, "log");
      await yargs([
        "controller",
        "set",
        account2.address,
        tableAlias,
        "--privateKey",
        account1.privateKey.slice(2),
        ...defaultArgs,
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
      // Set up test aliases file
      const aliasesFilePath = await temporaryWrite(`{}`, {
        extension: "json",
      });
      // Create new db instance to enable aliases
      const db = new Database({
        signer,
        autoWait: true,
        aliases: jsonFileAliases(aliasesFilePath),
      });
      const { meta } = await db
        .prepare("CREATE TABLE table_aliases (id int);")
        .all();
      const nameFromCreate = meta.txn?.name ?? "";
      const prefix = meta.txn?.prefix ?? "";

      // Check the aliases file was updated and matches with the prefix
      const nameMap = jsonFileAliases(aliasesFilePath).read();
      const tableAlias =
        Object.keys(nameMap).find(
          (alias) => nameMap[alias] === nameFromCreate
        ) ?? "";
      equal(tableAlias, prefix);

      const account = accounts[1];
      const privateKey = account.privateKey.slice(2);
      // Now, get the controller
      const consoleLog = spy(logger, "log");
      await yargs([
        "controller",
        "get",
        tableAlias,
        "--privateKey",
        privateKey,
        ...defaultArgs,
        "--aliases",
        aliasesFilePath,
      ])
        .command(mod)
        .parse();

      const value = consoleLog.getCall(0).firstArg;
      equal(value, "0x0000000000000000000000000000000000000000");
    });

    test("passes when locking a controller", async function () {
      // Set up test aliases file
      const aliasesFilePath = await temporaryWrite(`{}`, {
        extension: "json",
      });
      // Create new db instance to enable aliases
      const db = new Database({
        signer,
        autoWait: true,
        aliases: jsonFileAliases(aliasesFilePath),
      });
      const { meta } = await db
        .prepare("CREATE TABLE table_aliases (id int);")
        .all();
      const nameFromCreate = meta.txn?.name ?? "";
      const prefix = meta.txn?.prefix ?? "";

      // Check the aliases file was updated and matches with the prefix
      const nameMap = jsonFileAliases(aliasesFilePath).read();
      const tableAlias =
        Object.keys(nameMap).find(
          (alias) => nameMap[alias] === nameFromCreate
        ) ?? "";
      equal(tableAlias, prefix);

      const account = accounts[1];
      const privateKey = account.privateKey.slice(2);
      // Now, lock the controller
      const consoleLog = spy(logger, "log");
      await yargs([
        "controller",
        "lock",
        tableAlias,
        "--privateKey",
        privateKey,
        ...defaultArgs,
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
