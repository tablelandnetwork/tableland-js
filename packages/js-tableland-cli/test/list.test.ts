import { describe, test, afterEach, before } from "mocha";
import { spy, restore, assert, match } from "sinon";
import { getAccounts } from "@tableland/local";
import yargs from "yargs/yargs";
import * as mod from "../src/commands/list.js";

describe("commands/list", function () {
  before(async function () {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(function () {
    restore();
  });

  test("throws without privateKey", async function () {
    const consoleError = spy(console, "error");
    await yargs(["list"]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "must supply `--privateKey` or `address` positional"
    );
  });

  test("List throws without chain", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(console, "error");
    await yargs(["list", "--privateKey", privateKey]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "unsupported chain (see `chains` command for details)"
    );
  });

  test("throws with custom network", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(console, "error");
    await yargs(["list", "--chain", "custom", "--privateKey", privateKey])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleError,
      "unsupported chain (see `chains` command for details)"
    );
  });

  test("List passes with local-tableland", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleDir = spy(console, "dir");
    await yargs([
      "list",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleDir,
      match(function (value: any) {
        const array = value;
        return (
          Array.isArray(array) &&
          array.length > 0 &&
          array[0].tableId === "1" &&
          array[0].chainId === 31337
        );
      }, "does not match")
    );
  });
});