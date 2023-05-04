import { equal } from "node:assert";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore, assert } from "sinon";
import yargs from "yargs/yargs";
import { getAccounts, getDatabase } from "@tableland/local";
import * as mod from "../src/commands/transfer.js";
import { wait } from "../src/utils.js";
import { helpers } from "@tableland/sdk";

describe("commands/transfer", function () {
  this.timeout("30s");

  const accounts = getAccounts();
  // account 0 is the Validator's wallet, try to avoid using that
  const db = getDatabase(accounts[1]);
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
    const consoleError = spy(console, "error");
    await yargs(["transfer", tableName, "0x0000000000000000000000"])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleError,
      "No registry. This may be because you did not specify a private key with which to interact with the registry."
    );
  });

  test("throws with invalid chain", async function () {
    const account = accounts[1];
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(console, "error");
    await yargs([
      "transfer",
      tableName,
      "0x0000000000000000000000000000000000000000",
      "--chain",
      "does-not-exist",
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

  test("throws with invalid table name", async function () {
    const account = accounts[1];
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(console, "error");
    await yargs(["transfer", "fooz", "blah", "-k", privateKey])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleError,
      "error validating name: table name has wrong format: fooz"
    );
  });

  test("throws with invalid receiver address", async function () {
    const account = accounts[1];
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(console, "error");
    await yargs([
      "transfer",
      tableName,
      "0x00",
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
    ])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleError,
      'invalid address (argument="address", value="0x00", code=INVALID_ARGUMENT, version=address/5.7.0)'
    );
  });

  // Does transfering table have knock-on effects on other tables?
  test("Write passes with local-tableland", async function () {
    const [, account1, account2] = accounts;
    const account2Address = account2.address;
    const consoleLog = spy(console, "log");
    const privateKey = account1.privateKey.slice(2);
    await yargs([
      "transfer",
      tableName,
      account2Address,
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
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
