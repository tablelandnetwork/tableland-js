import { equal, match } from "node:assert";
import { describe, test, afterEach, before } from "mocha";
import { spy, stub, restore } from "sinon";
import { ethers } from "ethers";
import { getResolverUndefinedMock } from "./mock.js";
import yargs from "yargs/yargs";
import { temporaryWrite } from "tempy";
import mockStd from "mock-stdin";
import { getAccounts, getDatabase } from "@tableland/local";
import * as mod from "../src/commands/write.js";
import { wait, logger } from "../src/utils.js";

const accounts = getAccounts();
const db = getDatabase(accounts[1]);

describe("commands/write", function () {
  this.timeout("30s");

  before(async function () {
    await wait(500);
  });

  afterEach(function () {
    restore();
  });

  test("throws without privateKey", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["write", "blah"]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "missing required flag (`-k` or `--privateKey`)");
  });

  test("throws missing chain", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "write",
      "insert into fake_31337_1 values (1, 2, 3);",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "missing required flag (`-c` or `--chain`)");
  });

  test("throws with invalid chain", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "write",
      "insert into fake_31337_1 values (1, 2, 3);",
      "--privateKey",
      privateKey,
      "--chain",
      "foozbazz",
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "unsupported chain (see `chains` command for details)");
  });

  test("throws with invalid statement", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "write",
      // Note: cannot have a table named "table"
      "update table set counter=1 where rowid=0;",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    match(
      value,
      /error parsing statement: syntax error at position 12 near 'table'/
    );
  });

  test("throws when mixing write and create statements", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "write",
      "insert into fooz (a) values (1);create table fooz (a int);",
      "--chain",
      "local-tableland",
      "--prefix",
      "cooltable",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(
      value,
      "error parsing statement: syntax error at position 38 near 'create'"
    );
  });

  test("throws when used with create statement", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "write",
      "create table fooz (a int);",
      "--chain",
      "local-tableland",
      "--prefix",
      "cooltable",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "the `write` command can only accept write queries");
  });

  test("throws with missing file", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "write",
      "--file",
      "missing.sql",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    match(value, /ENOENT: no such file or directory/);
  });

  test("throws with empty stdin", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const stdin = mockStd.stdin();
    const consoleError = spy(logger, "error");
    setTimeout(() => {
      stdin.send("\n").end();
    }, 100);
    await yargs([
      "write",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(
      value,
      "missing input value (`statement`, `file`, or piped input from stdin required)"
    );
  });

  test("Write passes with local-tableland", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    await yargs([
      "write",
      "update healthbot_31337_1 set counter=1 where rowid=0;", // This just updates in place
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { transactionHash, link } = value.meta?.txn;

    equal(typeof transactionHash, "string");
    equal(transactionHash.startsWith("0x"), true);
    equal(!link, true);
  });

  test("Write to two tables passes", async function () {
    const account = accounts[1];
    const { meta: meta1 } = await db
      .prepare("create table multi_tbl_1 (a int, b text);")
      .all();
    const { meta: meta2 } = await db
      .prepare("create table multi_tbl_2 (a int, b text);")
      .all();

    const tableName1 = meta1.txn!.name;
    const tableName2 = meta2.txn!.name;

    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    await yargs([
      "write",
      `insert into ${tableName1} (a, b) values (1, 'one');
      insert into ${tableName2} (a, b) values (2, 'two');`,
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { transactionHash, link } = value.meta?.txn;

    equal(typeof transactionHash, "string");
    equal(transactionHash.startsWith("0x"), true);
    equal(!link, true);

    const results = await db.batch([
      db.prepare(`select * from ${tableName1};`),
      db.prepare(`select * from ${tableName2};`),
    ]);

    const result1 = (results[0] as any)?.results;
    const result2 = (results[1] as any)?.results;

    equal(result1[0].a, 1);
    equal(result1[0].b, "one");
    equal(result2[0].a, 2);
    equal(result2[0].b, "two");
  });

  test("passes when provided input from file", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    const path = await temporaryWrite(
      "update healthbot_31337_1 set counter=1;\n"
    );
    await yargs([
      "write",
      "--chain",
      "local-tableland",
      "--file",
      path,
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { transactionHash, link } = value.meta?.txn;

    equal(typeof transactionHash, "string");
    equal(transactionHash.startsWith("0x"), true);
    equal(!link, true);
  });

  test("passes when provided input from stdin", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    const stdin = mockStd.stdin();
    setTimeout(() => {
      stdin.send("update healthbot_31337_1 set counter=1;\n").end();
    }, 100);
    await yargs([
      "write",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { transactionHash, link } = value.meta?.txn;

    equal(typeof transactionHash, "string");
    equal(transactionHash.startsWith("0x"), true);
    equal(!link, true);
  });

  test("resolves table name to literal name if ens is not set", async function () {
    const resolverMock = stub(
      ethers.providers.JsonRpcProvider.prototype,
      "getResolver"
      // @ts-ignore
    ).callsFake(getResolverUndefinedMock);

    const { meta } = await db.prepare("CREATE TABLE ens_write (a int);").all();
    const tableName = meta.txn?.name ?? "";

    const account = accounts[1];
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");

    await yargs([
      "write",
      `insert into ${tableName} (a) values (1);`,
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "https://localhost:7070",
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { transactionHash, link } = value.meta?.txn;

    equal(typeof transactionHash, "string");
    equal(transactionHash.startsWith("0x"), true);
    equal(!link, true);

    equal(resolverMock.calledOnce, true);
  });
});
