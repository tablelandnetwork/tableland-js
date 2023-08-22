import { equal } from "node:assert";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore } from "sinon";
import { getAccounts } from "@tableland/local";
import yargs from "yargs/yargs";
import * as mod from "../src/commands/list.js";
import { logger, wait } from "../src/utils.js";

describe("commands/list", function () {
  before(async function () {
    await wait(1000);
  });

  afterEach(function () {
    restore();
  });

  test("throws without privateKey or address", async function () {
    const consoleError = spy(logger, "error");
    await yargs(["list", "--chain", "maticmum"]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "must supply `--privateKey` or `address` positional");
  });

  test("List throws without chain", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs(["list", "--privateKey", privateKey]).command(mod).parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "missing required flag (`-c` or `--chain`)");
  });

  test("List throws with invalid chain", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs(["list", "--privateKey", privateKey, "--chain", "foozbazz"])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "unsupported chain (see `chains` command for details)");
  });

  test("throws with custom network", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs(["list", "--chain", "custom", "--privateKey", privateKey])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "unsupported chain (see `chains` command for details)");
  });

  test("List passes with local-tableland", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");
    await yargs([
      "list",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);

    equal(Array.isArray(value), true);
    equal(value.length > 0, true);
    equal(value[0].tableId, "1");
    equal(value[0].chainId, 31337);
  });
});
