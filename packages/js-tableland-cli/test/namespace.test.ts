import { equal } from "node:assert";
import { describe, test, afterEach, beforeEach } from "mocha";
import { spy, restore, stub } from "sinon";
import yargs from "yargs/yargs";
import * as mod from "../src/commands/namespace.js";
import ensLib from "../src/lib/EnsCommand";
import { ethers } from "ethers";
import { getResolverMock } from "./mock.js";
import { logger } from "../src/utils.js";

describe("commands/namespace", function () {
  beforeEach(async function () {
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
  });

  afterEach(function () {
    restore();
  });

  test("get fails if used without experiment flag", async function () {
    const consoleLog = spy(logger, "log");
    await yargs([
      "namespace",
      "get",
      "foo.bar.eth",
      "--ensProviderUrl",
      "https://localhost:7070",
    ])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(0).firstArg;
    equal(
      value,
      "To use ENS, ensure you have set the enableEnsExperiment flag to true"
    );
  });

  test("set fails if used without experiment flag", async function () {
    const consoleLog = spy(logger, "log");
    await yargs([
      "namespace",
      "set",
      "foo.bar.eth",
      "mytable=my_table_31337_4",
      "--ensProviderUrl",
      "https://localhost:7070",
    ])
      .command(mod)
      .parse();

    const value = consoleLog.getCall(0).firstArg;
    equal(
      value,
      "To use ENS, ensure you have set the enableEnsExperiment flag to true"
    );
  });

  test("fails if ens name is invalid", async function () {
    const consoleError = spy(logger, "error");
    await yargs([
      "namespace",
      "set",
      "foo.bar.eth",
      "invalid&ensname=my_table_31337_4",
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "https://localhost:7070",
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "Only letters or underscores in key name");
  });

  test("fails if table name is invalid", async function () {
    const consoleError = spy(logger, "error");
    await yargs([
      "namespace",
      "set",
      "foo.bar.eth",
      "mytable=123-invalid_31337_4",
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "https://localhost:7070",
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "Tablename is invalid");
  });

  test("Get ENS name", async function () {
    stub(
      ethers.providers.JsonRpcProvider.prototype,
      "getResolver"
      // @ts-ignore
    ).callsFake(getResolverMock);

    const consoleLog = spy(logger, "log");
    await yargs([
      "namespace",
      "get",
      "foo.bar.eth",
      "--enableEnsExperiment",
      "--ensProviderUrl",
      "https://localhost:7070",
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    equal(value.value, "healthbot_31337_1");
  });

  test("Set ENS name", async function () {
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
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);
    equal(value.domain, "foo.bar.eth");
    equal(value.records[0].key, "healthbot");
    equal(value.records[0].value, "healthbot_31337_1");
  });
});
