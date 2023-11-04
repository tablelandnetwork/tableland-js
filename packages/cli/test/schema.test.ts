import { equal } from "node:assert";
import { ethers, getDefaultProvider } from "ethers";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore, stub } from "sinon";
import yargs from "yargs/yargs";
import { getAccounts } from "@tableland/local";
import { Database } from "@tableland/sdk";
import { jsonFileAliases } from "@tableland/node-helpers";
import { temporaryWrite } from "tempy";
import ensLib from "../src/lib/EnsCommand";
import * as mod from "../src/commands/schema";
import * as ns from "../src/commands/namespace.js";
import { logger, wait } from "../src/utils.js";
import { getResolverMock } from "./mock.js";
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

const accounts = getAccounts();
const wallet = accounts[1];
const provider = getDefaultProvider(TEST_PROVIDER_URL, { chainId: 31337 });
const signer = wallet.connect(provider);

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

  test("passes with valid ENS name", async function () {
    // Must do initial ENS setup and set the record name to the table
    await new Promise((resolve) => setTimeout(resolve, 1000));
    stub(ensLib, "ENS").callsFake(function () {
      return {
        withProvider: () => {
          return {
            setRecords: async () => {
              return false;
            },
          };
        },
      };
    });
    stub(ethers.providers.JsonRpcProvider.prototype, "getResolver").callsFake(
      getResolverMock
    );

    const consoleLog = spy(logger, "log");
    await yargs([
      "namespace",
      "set",
      "foo.bar.eth",
      "healthbot=healthbot_31337_1",
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "https://localhost:7070",
    ])
      .command(ns)
      .parse();

    let res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    equal(value.domain, "foo.bar.eth");
    equal(value.records[0].key, "healthbot");
    equal(value.records[0].value, "healthbot_31337_1");

    // Now, check the table schema using ENS as the name
    await yargs([
      "schema",
      "foo.bar.eth",
      ...defaultArgs,
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "https://localhost:7070",
    ])
      .command(mod)
      .parse();

    res = consoleLog.getCall(1).firstArg;
    equal(res, `{"columns":[{"name":"counter","type":"integer"}]}`);
  });

  test("passes with valid ENS name when invalid alias provided", async function () {
    // Must do initial ENS setup and set the record name to the table
    await new Promise((resolve) => setTimeout(resolve, 1000));
    stub(ensLib, "ENS").callsFake(function () {
      return {
        withProvider: () => {
          return {
            setRecords: async () => {
              return false;
            },
          };
        },
      };
    });
    stub(ethers.providers.JsonRpcProvider.prototype, "getResolver").callsFake(
      getResolverMock
    );

    const consoleLog = spy(logger, "log");
    await yargs([
      "namespace",
      "set",
      "foo.bar.eth",
      "healthbot=healthbot_31337_1",
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "https://localhost:7070",
    ])
      .command(ns)
      .parse();

    let res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    equal(value.domain, "foo.bar.eth");
    equal(value.records[0].key, "healthbot");
    equal(value.records[0].value, "healthbot_31337_1");

    // Create an empty aliases file
    const aliasesFilePath = await temporaryWrite(`{}`, {
      extension: "json",
    });

    // Now, check the table info using ENS as the name
    await yargs([
      "schema",
      "foo.bar.eth",
      ...defaultArgs,
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "https://localhost:7070",
      "--aliases",
      aliasesFilePath,
    ])
      .command(mod)
      .parse();

    res = consoleLog.getCall(1).firstArg;
    equal(res, `{"columns":[{"name":"counter","type":"integer"}]}`);
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
    const nameMap = await jsonFileAliases(aliasesFilePath).read();
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
