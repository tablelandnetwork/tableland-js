import { equal, match } from "node:assert";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore } from "sinon";
import yargs from "yargs/yargs";
import { temporaryWrite } from "tempy";
import { getAccounts } from "@tableland/local";
import { helpers, Database } from "@tableland/sdk";
import { jsonFileAliases } from "@tableland/node-helpers";
import { ZeroAddress } from "ethers";
import * as mod from "../src/commands/transfer.js";
import { logger, wait } from "../src/utils.js";
import { TEST_TIMEOUT_FACTOR, TEST_PROVIDER_URL } from "./setup";

const defaultArgs = [
  "--providerUrl",
  TEST_PROVIDER_URL,
  "--chain",
  "local-tableland",
];

// account[0] is the Validator's wallet, try to avoid using that
const accounts = getAccounts(TEST_PROVIDER_URL);
const signer = accounts[1];
const db = new Database({ signer, autoWait: true });

describe("commands/transfer", function () {
  this.timeout(30000 * TEST_TIMEOUT_FACTOR);

  let tableName: string;
  before(async function () {
    await wait(500);
    const { meta } = await db
      .prepare("CREATE TABLE test_transfer (a int);")
      .all();
    tableName = meta.txn?.name ?? "";
  });

  afterEach(function () {
    restore();
  });

  test("throws without privateKey", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["transfer", tableName, ZeroAddress, ...defaultArgs])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(
      value,
      "No registry. This may be because you did not specify a private key with which to interact with the registry."
    );
  });

  test("throws with invalid chain", async function () {
    const account = accounts[1];
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "transfer",
      tableName,
      ZeroAddress,
      "--chain",
      "does-not-exist",
      // don't use defaults since we are testing chain
      "--providerUrl",
      TEST_PROVIDER_URL,
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "unsupported chain (see `chains` command for details)");
  });

  test("throws with invalid table name", async function () {
    const account = accounts[1];
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs(["transfer", "fooz", "blah", "-k", privateKey, ...defaultArgs])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "error validating name: table name has wrong format: fooz");
  });

  test("throws with invalid receiver address", async function () {
    const account = accounts[1];
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "transfer",
      tableName,
      "0x00",
      "--privateKey",
      privateKey,
      ...defaultArgs,
    ])
      .command(mod)
      .parse();

    const value1 = consoleError.getCall(0).firstArg;
    match(value1, /invalid address/);

    await yargs([
      "transfer",
      tableName,
      "0xabcdefghijklmnopqrstuvwxyzabcdefabcdefab",
      "--privateKey",
      privateKey,
      ...defaultArgs,
    ])
      .command(mod)
      .parse();

    const value2 = consoleError.getCall(1).firstArg;
    match(value2, /invalid address/);
  });

  test("throws with invalid table aliases file", async function () {
    const [, account1, account2] = accounts;
    const account2Address = account2.address;
    const consoleError = spy(logger, "error");
    const privateKey = account1.privateKey.slice(2);

    // Transfer the table
    await yargs([
      "transfer",
      "invalid",
      account2Address,
      "--privateKey",
      privateKey,
      ...defaultArgs,
      "--aliases",
      "./path/to/invalid.json",
    ])
      .command(mod)
      .parse();

    const res = consoleError.getCall(0).firstArg;
    equal(res, "invalid aliases path");
  });

  test("throws with invalid table alias definition", async function () {
    const [, account1, account2] = accounts;
    const account2Address = account2.address;
    const consoleError = spy(logger, "error");
    const privateKey = account1.privateKey.slice(2);
    // Set up test aliases file
    const aliasesFilePath = await temporaryWrite(`{}`, { extension: "json" });

    // Transfer the table
    await yargs([
      "transfer",
      "invalid",
      account2Address,
      "--privateKey",
      privateKey,
      ...defaultArgs,
      "--aliases",
      aliasesFilePath,
    ])
      .command(mod)
      .parse();

    const res = consoleError.getCall(0).firstArg;
    equal(res, "error validating name: table name has wrong format: invalid");
  });

  // Does transfering table have knock-on effects on other tables?
  test("passes with local-tableland", async function () {
    const [, account1, account2] = accounts;
    const account2Address = account2.address;
    const consoleLog = spy(logger, "log");
    const privateKey = account1.privateKey.slice(2);
    await yargs([
      "transfer",
      tableName,
      account2Address,
      "--privateKey",
      privateKey,
      ...defaultArgs,
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { to, from } = value;

    equal(from.toLowerCase(), account1.address.toLowerCase());
    equal(
      to.toLowerCase(),
      helpers.getContractAddress("local-tableland").toLowerCase()
    );
  });

  test("passes with table alias", async function () {
    const [, account1, account2] = accounts;
    const account2Address = account2.address;
    const consoleLog = spy(logger, "log");
    const privateKey = account1.privateKey.slice(2);
    // Set up test aliases file
    const aliasesFilePath = await temporaryWrite(`{}`, { extension: "json" });

    // Create new db instance to enable aliases
    const db = new Database({
      signer,
      autoWait: true,
      aliases: jsonFileAliases(aliasesFilePath),
    });
    const { meta } = await db
      .prepare("CREATE TABLE table_aliases (id int);")
      .all();
    const name = meta.txn?.name ?? "";
    const prefix = meta.txn?.prefix ?? "";

    // Check the aliases file was updated and matches with the prefix
    const nameMap = jsonFileAliases(aliasesFilePath).read();
    const tableAlias =
      Object.keys(nameMap).find((alias) => nameMap[alias] === name) ?? "";
    equal(tableAlias, prefix);

    // Transfer the table
    await yargs([
      "transfer",
      tableAlias,
      account2Address,
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
    const { to, from } = value;

    equal(from.toLowerCase(), account1.address.toLowerCase());
    equal(
      to.toLowerCase(),
      helpers.getContractAddress("local-tableland").toLowerCase()
    );
  });
});
