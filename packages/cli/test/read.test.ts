import { equal, deepStrictEqual, match } from "node:assert";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore } from "sinon";
import yargs from "yargs/yargs";
import { temporaryWrite } from "tempy";
import mockStd from "mock-stdin";
import { Database } from "@tableland/sdk";
import { getAccounts } from "@tableland/local";
import { jsonFileAliases } from "@tableland/node-helpers";
import * as mod from "../src/commands/read.js";
import { wait, logger } from "../src/utils.js";
import {
  TEST_TIMEOUT_FACTOR,
  TEST_PROVIDER_URL,
  TEST_VALIDATOR_URL,
} from "./setup";

const defaultArgs = [
  "--baseUrl",
  TEST_VALIDATOR_URL,
  "--providerUrl",
  TEST_PROVIDER_URL,
  "--chain",
  "local-tableland",
];

const accounts = getAccounts(TEST_PROVIDER_URL);
const signer = accounts[1];
const db = new Database({ signer, autoWait: true });

describe("commands/read", function () {
  this.timeout(10000 * TEST_TIMEOUT_FACTOR);

  before(async function () {
    await wait(5000);
  });

  afterEach(async function () {
    restore();
    // ensure these tests don't hit rate limiting errors
    await wait(500);
  });

  test("fails with invalid table name", async function () {
    const consoleError = spy(logger, "error");
    const tableName = "something";
    const statement = `select * from ${tableName};`;
    await yargs(["read", statement, "--baseUrl", TEST_VALIDATOR_URL])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(
      value,
      `error validating name: table name has wrong format: ${tableName}`
    );
  });

  test("fails with invalid statement", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["read", "invalid;", "--baseUrl", TEST_VALIDATOR_URL])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(
      value,
      "error parsing statement: syntax error at position 7 near 'invalid'\ninvalid;\n^^^^^^^"
    );
  });

  test("fails when using unwrap without chainId", async function () {
    const consoleError = spy(logger, "error");
    await yargs([
      "read",
      "select counter from healthbot_31337_1 where counter = 1;",
      "--unwrap",
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "Chain ID is required to use unwrap or extract");
  });

  test("fails when using unwrap for multiple rows", async function () {
    const { meta } = await db
      .prepare("CREATE TABLE test_unwrap_multi (a int);")
      .all();
    const tableName = meta.txn?.name ?? "";
    await db.batch([
      db.prepare(`INSERT INTO ${tableName} VALUES (1);`),
      db.prepare(`INSERT INTO ${tableName} VALUES (2);`),
    ]);

    const consoleError = spy(logger, "error");
    await yargs([
      "read",
      `select * from ${tableName};`,
      "--format",
      "objects",
      "--unwrap",
      ...defaultArgs,
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "Can't unwrap multiple rows. Use --unwrap=false");
  });

  test("fails with missing file", async function () {
    const consoleError = spy(logger, "error");
    await yargs([
      "read",
      "--file",
      "missing.sql",
      "--baseUrl",
      TEST_VALIDATOR_URL,
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    match(value, /^ENOENT: no such file or directory/i);
  });

  test("fails with empty stdin", async function () {
    const stdin = mockStd.stdin();
    const consoleError = spy(logger, "error");
    setTimeout(() => {
      stdin.send("\n").end();
    }, 300);
    await yargs(["read", "--baseUrl", TEST_VALIDATOR_URL]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(
      value,
      "missing input value (`statement`, `file`, or piped input from stdin required)"
    );
  });

  test("fails with invalid table alias file", async function () {
    const [account] = accounts;
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    // Set up faux aliases file
    const aliasesFilePath = "./path/to/invalid.json";

    await yargs([
      "read",
      "SELECT * FROM table_aliases;",
      ...defaultArgs,
      "--privateKey",
      privateKey,
      "--aliases",
      aliasesFilePath,
    ])
      .command(mod)
      .parse();

    const res = consoleError.getCall(0).firstArg;
    equal(res, "invalid aliases path");
  });

  test("passes with extract option", async function () {
    const consoleLog = spy(logger, "log");
    await yargs([
      "read",
      "select counter from healthbot_31337_1;",
      "--extract",
      ...defaultArgs,
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);

    equal(Array.isArray(value), true);
    equal(value.includes(1), true);
  });

  test("passes with unwrap option", async function () {
    const consoleLog = spy(logger, "log");
    await yargs([
      "read",
      "select counter from healthbot_31337_1 where counter = 1;",
      "--unwrap",
      ...defaultArgs,
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    equal(value.counter, 1);
  });

  test("Read passes with local-tableland (defaults to 'objects' format)", async function () {
    const consoleLog = spy(logger, "log");
    await yargs(["read", "select * from healthbot_31337_1"])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    equal(value[0].counter, 1);
  });

  test("passes with alternate output format (objects)", async function () {
    const consoleLog = spy(logger, "log");
    await yargs([
      "read",
      "select * from healthbot_31337_1;",
      "--format",
      "objects",
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    equal(value[0].counter, 1);
  });

  test("passes with alternate output format (raw)", async function () {
    const consoleLog = spy(logger, "log");
    await yargs(["read", "select * from healthbot_31337_1;", "--format", "raw"])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(0).firstArg;
    equal(value, '{"columns":[{"name":"0"}],"rows":[[1]]}');
  });

  test("passes when provided input from file", async function () {
    const consoleLog = spy(logger, "log");
    const path = await temporaryWrite("select * from healthbot_31337_1;\n");
    await yargs(["read", "--file", path, "--format", "objects"])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    equal(value[0].counter, 1);
  });

  test("passes when provided input from stdin", async function () {
    const consoleLog = spy(logger, "log");
    const stdin = mockStd.stdin();
    setTimeout(() => {
      stdin.send("select * from healthbot_31337_1;\n").end();
    }, 100);
    await yargs([
      "read",
      "--format",
      "objects",
      "--providerUrl",
      "http://127.0.0.1:8545",
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    equal(value[0].counter, 1);
  });

  test("Custom baseUrl is called", async function () {
    const fetchSpy = spy(global, "fetch");
    await yargs([
      "read",
      "select * from healthbot_31337_1;",
      "--format",
      "pretty",
      "--baseUrl",
      "https://localhost:8909",
    ])
      .command(mod)
      .parse();

    const url = fetchSpy.getCall(0).firstArg;
    match(url, /^https:\/\/localhost:8909\//);
  });

  test("passes with alternate output format (pretty)", async function () {
    const consoleLog = spy(logger, "table");
    await yargs([
      "read",
      "select * from healthbot_31337_1;",
      "--format",
      "pretty",
    ])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(0).firstArg;

    deepStrictEqual(value, [{ counter: 1 }]);
  });

  test("passes with alternate output format (table)", async function () {
    const consoleLog = spy(logger, "log");
    await yargs([
      "read",
      "select * from healthbot_31337_1;",
      "--format",
      "table",
    ])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(0).firstArg;
    deepStrictEqual(value, '{"columns":[{"name":"counter"}],"rows":[[1]]}');
  });

  test("passes with output format (table) when results are empty", async function () {
    const { meta } = await db
      .prepare("CREATE TABLE empty_table (a int);")
      .all();
    const tableName = meta.txn?.name ?? "";

    const consoleLog = spy(logger, "log");
    await yargs(["read", `select * from ${tableName};`, "--format", "table"])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(0).firstArg;
    deepStrictEqual(value, '{"columns":[],"rows":[]}');
  });

  test("passes with table aliases", async function () {
    // Set up test aliases file
    const aliasesFilePath = await temporaryWrite(`{}`, { extension: "json" });

    // Create new db instance to enable aliases
    const db = new Database({
      signer,
      autoWait: true,
      aliases: jsonFileAliases(aliasesFilePath),
    });
    let { meta } = await db
      .prepare("CREATE TABLE table_aliases (id int);")
      .all();
    const name = meta.txn?.name ?? "";
    const prefix = meta.txn?.prefix ?? "";

    // Check the aliases file was updated and matches with the prefix
    const nameMap = jsonFileAliases(aliasesFilePath).read();
    const tableAlias =
      Object.keys(nameMap).find((alias) => nameMap[alias] === name) ?? "";
    equal(tableAlias, prefix);

    // Write to the table
    ({ meta } = await db.prepare(`INSERT INTO ${name} values (1);`).run());
    await meta.txn?.wait();

    const consoleLog = spy(logger, "log");
    await yargs([
      "read",
      `select * from ${tableAlias};`,
      "--aliases",
      aliasesFilePath,
    ])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(0).firstArg;
    deepStrictEqual(value, '[{"id":1}]');
  });
});
