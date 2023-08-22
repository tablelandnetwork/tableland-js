import { equal } from "node:assert";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore, stub } from "sinon";
import yargs from "yargs/yargs";
import { ethers } from "ethers";
import { getAccounts } from "@tableland/local";
import { helpers, Database } from "@tableland/sdk";
import { temporaryWrite } from "tempy";
import ensLib from "../src/lib/EnsCommand";
import * as mod from "../src/commands/info.js";
import * as ns from "../src/commands/namespace.js";
import { jsonFileAliases, logger, wait } from "../src/utils.js";
import { getResolverMock } from "./mock.js";

describe("commands/info", function () {
  this.timeout("30s");

  before(async function () {
    await wait(1000);
  });

  afterEach(function () {
    restore();
  });

  test("throws with invalid table name", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["info", "invalid_name"]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(
      value,
      "invalid table name (name format is `{prefix}_{chainId}_{tableId}`)"
    );
  });

  test("throws with invalid chain", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["info", "valid_9999_0"]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "unsupported chain (see `chains` command for details)");
  });

  test("throws with missing table", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["info", "ignored_31337_99"]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "Not Found");
  });

  test("throws with invalid table aliases file", async function () {
    const consoleError = spy(logger, "error");
    await yargs([
      "info",
      "table_alias",
      "--chain",
      "local-tableland",
      "--baseUrl",
      "http://localhost:8080/api/v1",
      "--aliases",
      "./invalid.json",
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "invalid table aliases file");
  });

  test("throws with invalid table alias definition", async function () {
    // Set up test aliases file
    const aliasesFilePath = await temporaryWrite(`{}`, {
      extension: "json",
    });
    const consoleError = spy(logger, "error");
    await yargs([
      "info",
      "table_alias",
      "--chain",
      "local-tableland",
      "--baseUrl",
      "http://localhost:8080/api/v1",
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
    await yargs(["info", "healthbot_31337_1"]).command(mod).parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { name, attributes, externalUrl } = value;

    equal(name, "healthbot_31337_1");
    equal(externalUrl, "http://localhost:8080/api/v1/tables/31337/1");
    equal(Array.isArray(attributes), true);
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
    let value = JSON.parse(res);
    equal(value.domain, "foo.bar.eth");
    equal(value.records[0].key, "healthbot");
    equal(value.records[0].value, "healthbot_31337_1");

    // Now, check the table info using ENS as the name
    await yargs([
      "info",
      "foo.bar.eth",
      "--chain",
      "local-tableland",
      "--baseUrl",
      "http://localhost:8080/api/v1",
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "https://localhost:7070",
    ])
      .command(mod)
      .parse();

    res = consoleLog.getCall(1).firstArg;
    value = JSON.parse(res);
    const { name, attributes, externalUrl } = value;

    equal(name, "healthbot_31337_1");
    equal(externalUrl, "http://localhost:8080/api/v1/tables/31337/1");
    equal(Array.isArray(attributes), true);
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
    let value = JSON.parse(res);
    equal(value.domain, "foo.bar.eth");
    equal(value.records[0].key, "healthbot");
    equal(value.records[0].value, "healthbot_31337_1");

    // Create an empty aliases file
    const aliasesFilePath = await temporaryWrite(`{}`, {
      extension: "json",
    });

    // Now, check the table info using ENS as the name
    await yargs([
      "info",
      "foo.bar.eth",
      "--chain",
      "local-tableland",
      "--baseUrl",
      "http://localhost:8080/api/v1",
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "https://localhost:7070",
      "--aliases",
      aliasesFilePath,
    ])
      .command(mod)
      .parse();

    res = consoleLog.getCall(1).firstArg;
    value = JSON.parse(res);
    const { name, attributes, externalUrl } = value;

    equal(name, "healthbot_31337_1");
    equal(externalUrl, "http://localhost:8080/api/v1/tables/31337/1");
    equal(Array.isArray(attributes), true);
  });

  test("passes with table aliases", async function () {
    const [account] = getAccounts();
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
      Object.keys(nameMap).find((alias) => nameMap[alias] === nameFromCreate) ??
      "";
    equal(tableAlias, prefix);

    // Get table info via alias
    const consoleLog = spy(logger, "log");
    await yargs([
      "info",
      tableAlias,
      "--chain",
      "local-tableland",
      "--baseUrl",
      "http://localhost:8080/api/v1",
      "--aliases",
      aliasesFilePath,
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    const { name: nameFromInfo, attributes } = value;

    equal(nameFromInfo, nameFromCreate);
    equal(Array.isArray(attributes), true);
  });
});
