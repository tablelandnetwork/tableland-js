import { describe, test, afterEach, beforeEach } from "mocha";
import { spy, restore, assert, stub, match } from "sinon";
import yargs from "yargs/yargs";
import * as mod from "../src/commands/namespace.js";
import ensLib from "../src/lib/EnsCommand";
import { ethers } from "ethers";
import { getResolverMock } from "./mock.js";

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

    stub(ethers.providers.JsonRpcProvider.prototype, "getResolver")
      // @ts-ignore
      .callsFake(getResolverMock);
  });

  afterEach(function () {
    restore();
  });

  test("Get ENS name", async function () {
    const consoleLog = spy(console, "log");
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

    assert.calledWith(
      consoleLog,
      match((value) => {
        value = JSON.parse(value);

        return value.value === "healthbot_31337_1";
      }, "Doesn't match expected output")
    );
  });

  test("Set ENS name", async function () {
    const consoleLog = spy(console, "log");
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

    assert.calledWith(
      consoleLog,
      match((value) => {
        value = JSON.parse(value);

        return (
          value.domain === "foo.bar.eth" &&
          value.records[0].key === "healthbot" &&
          value.records[0].value === "healthbot_31337_1"
        );
      }, "Doesn't match expected output")
    );
  });
});
