import { getAccounts } from "@tableland/local";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore, assert } from "sinon";
import yargs from "yargs/yargs";
import { connect, ConnectOptions } from "@tableland/sdk";
import { getWalletWithProvider, wait } from "../src/utils.js";
import * as mod from "../src/commands/receipt.js";

describe("commands/receipt", function () {
  this.timeout("10s");

  before(async function () {
    await wait(500);
  });

  afterEach(function () {
    restore();
  });

  test("throws without privateKey", async function () {
    const consoleError = spy(console, "error");
    await yargs(["receipt", "blah"]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "missing required flag (`-k` or `--privateKey`)"
    );
  });

  test("throws without chain", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(console, "error");
    await yargs(["receipt", "--privateKey", privateKey, "ignored"])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleError,
      "unsupported chain (see `chains` command for details)"
    );
  });

  test("throws with invalid tx hash", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(console, "error");
    await yargs([
      "receipt",
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
      "ignored",
    ])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleError,
      "calling GetReceipt: invalid txn hash: hex string without 0x prefix"
    );
  });

  test("passes with local-tableland", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(console, "log");

    const signer = getWalletWithProvider({
      privateKey,
      chain: "local-tableland",
      providerUrl: undefined,
    });
    const options: ConnectOptions = {
      chain: "local-tableland",
      rpcRelay: false,
      signer,
    };

    const { hash } = await connect(options).write(
      "update healthbot_31337_1 set counter=1;"
    );
    await yargs([
      "receipt",
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
      hash,
    ])
      .command(mod)
      .parse();
    // TODO: Ideally, we check the response here, but the hashes aren't deterministic
    assert.calledOnce(consoleLog);
  });
});
