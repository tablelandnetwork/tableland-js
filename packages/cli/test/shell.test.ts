import { deepStrictEqual, equal, match } from "node:assert";
import { describe, test } from "mocha";
import { spy, restore, stub, assert } from "sinon";
import yargs from "yargs/yargs";
import mockStd from "mock-stdin";
import { getAccounts, getDatabase } from "@tableland/local";
import { ethers } from "ethers";
import { temporaryWrite } from "tempy";
import * as mod from "../src/commands/shell.js";
import { wait, logger } from "../src/utils.js";
import { getResolverMock } from "./mock.js";

describe("commands/shell", function () {
  this.timeout("30s");

  const accounts = getAccounts();
  const db = getDatabase(accounts[1]);

  before(async function () {
    await wait(10000);
  });

  afterEach(function () {
    restore();
  });

  test("fails without private key", async function () {
    const consoleError = spy(logger, "error");

    await yargs(["shell", "--chain", "local-tableland"]).command(mod).parse();

    const value = consoleError.getCall(0).args[0];
    equal(
      value,
      "To send transactions, you need to specify a privateKey, providerUrl, and chain"
    );
  });

  test("works with single line", async function () {
    const consoleLog = spy(logger, "log");
    const stdin = mockStd.stdin();

    setTimeout(() => {
      stdin.send("select * from healthbot_31337_1;\n").end();
    }, 1000);

    const privateKey = accounts[0].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(3).args[0];
    equal(value, '[{"counter":1}]');
  });

  test("ENS in shell with single line", async function () {
    const fullResolverStub = stub(
      ethers.providers.JsonRpcProvider.prototype,
      "getResolver"
    ).callsFake(getResolverMock);

    const consoleLog = spy(logger, "log");
    const stdin = mockStd.stdin();

    setTimeout(() => {
      stdin.send("select * from [foo.bar.eth];\n").end();
    }, 2000);

    const privateKey = accounts[0].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "http://localhost:8545",
    ])
      .command(mod)
      .parse();

    fullResolverStub.reset();

    const call4 = consoleLog.getCall(4);
    equal(call4.args[0], '[{"counter":1}]');
  });

  test("ENS in shell with backtics", async function () {
    const fullResolverStub = stub(
      ethers.providers.JsonRpcProvider.prototype,
      "getResolver"
    ).callsFake(getResolverMock);

    const consoleLog = spy(logger, "log");
    const stdin = mockStd.stdin();

    setTimeout(() => {
      stdin.send("select * from `foo.bar.eth`;\n").end();
    }, 2000);

    const privateKey = accounts[0].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "http://localhost:8545",
    ])
      .command(mod)
      .parse();

    fullResolverStub.reset();

    const call4 = consoleLog.getCall(4);
    equal(call4.args[0], '[{"counter":1}]');
  });

  test("ENS in shell with double quotes", async function () {
    const fullResolverStub = stub(
      ethers.providers.JsonRpcProvider.prototype,
      "getResolver"
    ).callsFake(getResolverMock);

    const consoleLog = spy(logger, "log");
    const stdin = mockStd.stdin();

    setTimeout(() => {
      stdin.send(`select * from "foo.bar.eth";\n`).end();
    }, 2000);

    const privateKey = accounts[0].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "http://localhost:8545",
    ])
      .command(mod)
      .parse();

    fullResolverStub.reset();

    const value = consoleLog.getCall(4).args[0];
    equal(value, '[{"counter":1}]');
  });

  test("works with initial input", async function () {
    const consoleLog = spy(logger, "log");

    const privateKey = accounts[0].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
      "SELECT * FROM healthbot_31337_1;",
    ])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(3).args[0];
    equal(value, '[{"counter":1}]');
  });

  test("handles invalid query", async function () {
    const consoleError = spy(logger, "error");
    const stdin = mockStd.stdin();

    setTimeout(() => {
      stdin.send("select non_existent_table;\n").end();
    }, 1000);

    const privateKey = accounts[0].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).args[0] as string;
    match(value, /error parsing statement/);
  });

  test("write queries continue with 'y' input", async function () {
    const consoleLog = spy(logger, "log");
    const stdin = mockStd.stdin();

    setTimeout(() => {
      stdin.send("CREATE TABLE sometable (id integer, message text);\n");
      setTimeout(() => {
        stdin.send("y\n");
      }, 500);
    }, 1000);

    const privateKey = accounts[0].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(4).args[0];
    match(value, /"createdTable":/);
    match(value, /sometable_31337_\d+/);
  });

  test("write queries aborts with 'n' input", async function () {
    const consoleLog = spy(logger, "log");
    const stdin = mockStd.stdin();

    setTimeout(() => {
      stdin.send("UPDATE SomeTable SET message = 'yay' WHERE id = 1;\n");
      setTimeout(() => {
        stdin.send("n\n");
      }, 500);
    }, 1000);

    const privateKey = accounts[0].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    match(consoleLog.getCall(3).args[0], /Aborting\./i);
  });

  test("throws without chain", async function () {
    const privateKey = accounts[0].privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs(["shell", "--privateKey", privateKey]).command(mod).parse();

    const value = consoleError.getCall(0).args[0];
    equal(value, "missing required flag (`-c` or `--chain`)");
  });

  test("throws with invalid chain", async function () {
    const privateKey = accounts[0].privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs(["shell", "--privateKey", privateKey, "--chain", "foozbazz"])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).args[0];
    equal(value, "unsupported chain (see `chains` command for details)");
  });

  test("throws with invalid table aliases file", async function () {
    const consoleError = spy(logger, "error");
    // Set up faux aliases file
    const aliasesFilePath = "./invalid.json";

    const privateKey = accounts[0].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
      "--aliases",
      aliasesFilePath,
    ])
      .command(mod)
      .parse();

    const res = consoleError.getCall(0).args[0];
    equal(res, "invalid table aliases file");
  });

  test("works when custom baseUrl is called", async function () {
    const stdin = mockStd.stdin();
    const fetchSpy = spy(global, "fetch");

    setTimeout(() => {
      stdin.send("select * from\n").send("healthbot_31337_1;\n").end();
    }, 1000);

    const privateKey = accounts[0].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
      "--baseUrl",
      "https://localhost:8909",
    ])
      .command(mod)
      .parse();

    const value = fetchSpy.getCall(0).args[0] as string;
    match(value, /https:\/\/localhost:8909\//);
  });

  test(".exit exits the shell", async function () {
    const stdin = mockStd.stdin();
    const exit = stub(process, "exit");

    setTimeout(() => {
      stdin.send(".exit\n").end();
    }, 1000);

    const privateKey = accounts[0].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();
    assert.called(exit);
    exit.restore();
  });

  test("works with write statement", async function () {
    const { meta } = await db
      .prepare("CREATE TABLE shell_write (a int);")
      .all();
    const tableName = meta.txn?.name ?? "";

    const consoleLog = spy(logger, "log");
    const stdin = mockStd.stdin();

    setTimeout(() => {
      stdin.send(`INSERT INTO ${tableName} VALUES (1);\n`);
      setTimeout(() => {
        stdin.send("y\n");
      }, 500);
    }, 1000);

    const privateKey = accounts[1].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(3).args[0];
    equal(value, "[]");
  });

  test("works with multi-line", async function () {
    const consoleLog = spy(logger, "log");
    const stdin = mockStd.stdin();

    setTimeout(() => {
      stdin.send("select * from\n").send("healthbot_31337_1;\n").end();
    }, 1000);

    const privateKey = accounts[0].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(3).args[0];
    equal(value, '[{"counter":1}]');
  });

  test("can print help statement", async function () {
    const consoleLog = spy(logger, "log");
    const stdin = mockStd.stdin();

    setTimeout(() => {
      stdin.send(`.help\n`);
    }, 1000);

    const privateKey = accounts[1].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(3).args[0];
    equal(
      value,
      `Commands:
[query] - run a query
.exit - exit the shell
.help - show this help

SQL Queries can be multi-line, and must end with a semicolon (;)`
    );
  });

  test("works with table aliases (creates, writes, reads)", async function () {
    const consoleLog = spy(logger, "log");
    const stdin = mockStd.stdin();
    // Set up test aliases file
    const aliasesFilePath = await temporaryWrite(`{}`, { extension: "json" });

    // First, create a table
    setTimeout(() => {
      stdin.send("CREATE TABLE table_aliases (id int);\n");
      setTimeout(() => {
        stdin.send("y\n");
      }, 500);
    }, 1000);

    const privateKey = accounts[0].privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
      "--aliases",
      aliasesFilePath,
    ])
      .command(mod)
      .parse();

    // Check the create was successful
    let res = consoleLog.getCall(4).args[0];
    let filter = res.replace("tableland> ", "");
    let value = JSON.parse(filter);
    const { createdTable, alias } = value;
    match(createdTable, /table_aliases_31337_\d+/);
    equal(alias, "table_aliases");

    // Write to the table using the alias
    stdin.send(`INSERT INTO table_aliases VALUES (1);\n`);
    setTimeout(() => {
      stdin.send("y\n");
    }, 500);
    await wait(4000);

    // Check the write was successful
    res = consoleLog.getCall(6).args[0];
    filter = res.replace("tableland> ", "");
    value = JSON.parse(filter);
    const { updatedTable, alias: aliasFromWrite } = value;
    match(updatedTable, /table_aliases_31337_\d+/);
    equal(aliasFromWrite, alias);

    // Read from the table using the alias
    stdin.send(`SELECT * FROM table_aliases;\n`);
    await wait(2000);

    // Check the read was successful
    res = consoleLog.getCall(7).args[0];
    filter = res.replace("tableland> ", "");
    deepStrictEqual(filter, '[{"id":1}]');
  });
});
