import { equal } from "node:assert";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore } from "sinon";
import yargs from "yargs/yargs";
import { getAccounts } from "@tableland/local";
import { Database } from "@tableland/sdk";
import { jsonFileAliases } from "@tableland/node-helpers";
import { temporaryWrite } from "tempy";
import * as mod from "../src/commands/schema";
import { logger, wait } from "../src/utils.js";
import {
  TEST_TIMEOUT_FACTOR,
  TEST_PROVIDER_URL,
  TEST_VALIDATOR_URL,
} from "./setup";

const defaultArgs = [
  "--chain",
  "local-tableland",
  "--baseUrl",
  TEST_VALIDATOR_URL,
];

const accounts = getAccounts(TEST_PROVIDER_URL);
const signer = accounts[1];

describe("commands/schema", function () {
  this.timeout(10000 * TEST_TIMEOUT_FACTOR);

  before(async function () {
    await wait(1000);
  });

  afterEach(function () {
    restore();
  });

  test("throws with invalid table name", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["schema", "invalid_name"]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(
      value,
      "invalid table name (name format is `{prefix}_{chainId}_{tableId}`)"
    );
  });

  test("throws with invalid chain", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["schema", "valid_9999_0"]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "unsupported chain (see `chains` command for details)");
  });

  test("throws with missing table", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["schema", "ignored_31337_99"]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "Not Found");
  });

  test("throws with invalid table aliases file", async function () {
    const consoleError = spy(logger, "error");
    await yargs([
      "schema",
      "table_alias",
      ...defaultArgs,
      "--aliases",
      "./path/to/invalid.json",
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "invalid aliases path");
  });

  test("throws with invalid table alias definition", async function () {
    // Set up test aliases file
    const aliasesFilePath = await temporaryWrite(`{}`, {
      extension: "json",
    });
    const consoleError = spy(logger, "error");
    await yargs([
      "schema",
      "table_alias",
      ...defaultArgs,
      "--aliases",
      aliasesFilePath,
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(
      value,
      "invalid table name (name format is `{prefix}_{chainId}_{tableId}`)"
    );
  });

  test("passes with local-tableland", async function () {
    const consoleLog = spy(logger, "log");
    await yargs(["schema", "healthbot_31337_1"]).command(mod).parse();

    const value = consoleLog.getCall(0).firstArg;
    equal(value, `{"columns":[{"name":"counter","type":"integer"}]}`);
  });

  test("passes with table aliases", async function () {
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
      Object.keys(nameMap).find((alias) => nameMap[alias] === nameFromCreate) ??
      "";
    equal(tableAlias, prefix);

    // Get table schema via alias
    const consoleLog = spy(logger, "log");
    await yargs(["schema", tableAlias, "--aliases", aliasesFilePath])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(0).firstArg;
    equal(value, `{"columns":[{"name":"id","type":"int"}]}`);
  });
});
