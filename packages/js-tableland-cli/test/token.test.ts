import { describe, test, afterEach, before } from "mocha";
import { spy, restore, assert } from "sinon";
import { getAccounts } from "@tableland/local";
import yargs from "yargs/yargs";
import * as mod from "../src/commands/token.js";

describe("commands/token", function () {
  before(async function () {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(function () {
    restore();
  });

  test("throws without privateKey", async function () {
    const consoleError = spy(console, "error");
    await yargs(["token"]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "missing required flag (`-k` or `--privateKey`)"
    );
  });

  test("throws without chain", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(console, "error");
    await yargs(["token", "--privateKey", privateKey]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "unsupported chain (see `chains` command for details)"
    );
  });

  test("passes without network connection", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(console, "log");
    const consoleError = spy(console, "error");
    await yargs([
      "token",
      "--chain",
      "local-tableland",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();
    assert.calledOnce(consoleLog);
    assert.notCalled(consoleError);
  });
});
