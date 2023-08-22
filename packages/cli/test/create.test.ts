import { equal, match } from "node:assert";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore, stub } from "sinon";
import yargs from "yargs/yargs";
import { temporaryWrite } from "tempy";
import mockStd from "mock-stdin";
import { getAccounts } from "@tableland/local";
import { ethers } from "ethers";
import * as mod from "../src/commands/create.js";
import { wait, logger, jsonFileAliases } from "../src/utils.js";
import { getResolverMock } from "./mock.js";

const accounts = getAccounts();

describe("commands/create", function () {
  this.timeout("30s");

  before(async function () {
    await wait(1000);
  });

  afterEach(function () {
    restore();
  });

  test("throws without privateKey", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["create", "blah"]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "missing required flag (`-k` or `--privateKey`)");
  });

  test("throws if chain not provided", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "create",
      "(id int primary key, desc text)",
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
      "create",
      "(id int primary key, desc text)",
      "--privateKey",
      privateKey,
      "--prefix",
      "invalid_chain_table",
      "--chain",
      "foozbaaz",
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
      "create",
      "invalid",
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
      "error parsing statement: syntax error at position 32 near ')'"
    );
  });

  test("throws when mixing create and write statements", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "create",
      "create table fooz (a int);insert into fooz (a) values (1);",
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
    equal(value, "the `create` command can only accept create queries");
  });

  test("throws with missing file", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "create",
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
    match(value, /ENOENT: no such file or directory/i);
  });

  test("throws with empty stdin", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const stdin = mockStd.stdin();
    const consoleError = spy(logger, "error");
    setTimeout(() => {
      stdin.send("\n").end();
    }, 300);
    await yargs([
      "create",
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
      "missing input value (`schema`, `file`, or piped input from stdin required)"
    );
  });

  test("throws with invalid table alias file", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    // Set up faux aliases file
    const aliasesFilePath = "./invalid.json";

    await yargs([
      "create",
      "id int",
      "--prefix",
      "table_aliases",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
      "--aliases",
      aliasesFilePath,
    ])
      .command(mod)
      .parse();

    const res = consoleError.getCall(0).firstArg;
    equal(res, "invalid table aliases file");
  });

  test("creates table if prefix not provided", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    await yargs([
      "create",
      "id int primary key, name text",
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { prefix, name } = value.meta.txn;
    equal(prefix, "");
    match(name, /^_31337_[0-9]+$/);
  });

  test("create passes with local-tableland", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    await yargs([
      "create",
      "id int primary key, name text",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
      "--prefix",
      "first_table",
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { prefix, name, chainId, tableId, transactionHash } = value.meta.txn;

    equal(prefix, "first_table");
    equal(chainId, 31337);
    equal(name.startsWith(prefix), true);
    equal(name.endsWith(tableId), true);
    equal(typeof transactionHash, "string");
    equal(transactionHash.startsWith("0x"), true);
  });

  test("Create works with chain as number", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    await yargs([
      "create",
      "id int primary key, name text",
      "--chain",
      "31337",
      "--privateKey",
      privateKey,
      "--prefix",
      "chainid_table",
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { prefix, name, chainId, tableId, transactionHash } = value.meta.txn;

    equal(prefix, "chainid_table");
    equal(chainId, 31337);
    equal(name.startsWith(prefix), true);
    equal(name.endsWith(tableId), true);
    equal(typeof transactionHash, "string");
    equal(transactionHash.startsWith("0x"), true);
  });

  test("passes with full create statement (override prefix)", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    await yargs([
      "create",
      "create table second_table (id int primary key, name text);",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
      "--prefix",
      "ignore_me",
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { prefix, name, chainId, tableId, transactionHash } = value.meta.txn;

    equal(prefix, "second_table");
    equal(chainId, 31337);
    equal(name.startsWith(prefix), true);
    equal(name.endsWith(tableId), true);
    equal(typeof transactionHash, "string");
    equal(transactionHash.startsWith("0x"), true);
  });

  test("passes with two create statements", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    await yargs([
      "create",
      `create table first_table (id int primary key, name text);
      create table second_table (id int primary key, name text);`,
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
      "--prefix",
      "ignore_me",
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { prefixes, names, chainId, tableIds, transactionHash } =
      value.meta.txn;

    equal(prefixes.length, 2);
    equal(prefixes[0], "first_table");
    equal(prefixes[1], "second_table");
    equal(chainId, 31337);
    equal(typeof transactionHash, "string");
    equal(transactionHash.startsWith("0x"), true);
    equal(names.length, 2);
    equal(names[0].startsWith("first_table"), true);
    equal(names[1].startsWith("second_table"), true);
    equal(names[0].endsWith(tableIds[0]), true);
    equal(names[1].endsWith(tableIds[1]), true);
  });

  test("passes when provided input from file", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    const path = await temporaryWrite(`\nid int primary key,\nname text\n`);
    await yargs([
      "create",
      "--chain",
      "local-tableland",
      "--file",
      path,
      "--privateKey",
      privateKey,
      "--prefix",
      "file_test",
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { prefix, name, chainId, tableId, transactionHash } = value.meta.txn;

    equal(prefix, "file_test");
    equal(chainId, 31337);
    equal(typeof transactionHash, "string");
    equal(name.startsWith(prefix), true);
    equal(name.endsWith(tableId), true);
    equal(transactionHash.startsWith("0x"), true);
  });

  test("passes when provided input from stdin", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    const stdin = mockStd.stdin();
    setTimeout(() => {
      stdin
        .send("create table stdin_test (id int primary key, name text);\n")
        .end();
    }, 100);
    await yargs([
      "create",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { prefix, name, chainId, tableId, transactionHash } = value.meta.txn;

    equal(prefix, "stdin_test");
    equal(chainId, 31337);
    equal(name.startsWith(prefix), true);
    equal(name.endsWith(tableId), true);
    equal(typeof transactionHash, "string");
    equal(transactionHash.startsWith("0x"), true);
  });

  test("create namespace with table using ENS", async () => {
    const fullReolverStub = stub(
      ethers.providers.JsonRpcProvider.prototype,
      "getResolver"
    ).callsFake(getResolverMock);

    const consoleLog = spy(logger, "log");
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    await yargs([
      "create",
      "id integer, message text",
      "hello",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
      "--ns",
      "foo.bar.eth",
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "https://localhost:8080",
    ])
      .command(mod)
      .parse();

    fullReolverStub.restore();

    const res = consoleLog.getCall(1).firstArg;
    const value = JSON.parse(res);
    equal(value.ensNameRegistered, true);
  });

  test("create can accept custom providerUrl", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");

    await yargs([
      "create",
      "id int primary key, name text",
      "--prefix",
      "custom_url_table",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
      "--providerUrl",
      "http://localhost:9876",
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "cannot determine provider chain ID");
  });

  test("passes with table aliases", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    // Set up test aliases file
    const aliasesFilePath = await temporaryWrite(`{}`, { extension: "json" });

    await yargs([
      "create",
      "id int",
      "--prefix",
      "table_aliases",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
      "--aliases",
      aliasesFilePath,
    ])
      .command(mod)
      .parse();

    let res = consoleLog.getCall(0).firstArg;
    let value = JSON.parse(res);
    const { prefix1, name1 } = value.meta.txn;

    // Check the aliases file was updated and matches with the prefix
    let nameMap = await jsonFileAliases(aliasesFilePath).read();
    const tableAlias1 = Object.keys(nameMap).find(
      (alias) => nameMap[alias] === name1
    );
    equal(tableAlias1, prefix1);

    // Make sure that creating another table mutates the file, not overwrites it
    await yargs([
      "create",
      "id int",
      "--prefix",
      "second_table",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
      "--aliases",
      aliasesFilePath,
    ])
      .command(mod)
      .parse();

    res = consoleLog.getCall(0).firstArg;
    value = JSON.parse(res);
    const { prefix2, name2 } = value.meta.txn;

    // Check the aliases file was updated and matches with both prefixes
    nameMap = await jsonFileAliases(aliasesFilePath).read();
    const tableAlias2 = Object.keys(nameMap).find(
      (alias) => nameMap[alias] === name2
    );
    equal(tableAlias1, prefix1);
    equal(tableAlias2, prefix2);
  });
});
