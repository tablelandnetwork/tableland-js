import { equal, match } from "node:assert";
import { Database } from "@tableland/sdk";
import { getAccounts } from "@tableland/local";
import { describe, test, afterEach, before } from "mocha";
import { spy, restore } from "sinon";
import yargs from "yargs/yargs";
import { wait, logger } from "../src/utils.js";
import * as mod from "../src/commands/receipt.js";
import { TEST_TIMEOUT_FACTOR, TEST_PROVIDER_URL } from "./setup";

const defaultArgs = ["--providerUrl", TEST_PROVIDER_URL];

const accounts = getAccounts(TEST_PROVIDER_URL);
// using the validator wallet since the test is updating healthbot
const signer = accounts[0];
const db = new Database({ signer, autoWait: true });

describe("commands/receipt", function () {
  this.timeout(30000 * TEST_TIMEOUT_FACTOR);

  before(async function () {
    await wait(10000);
  });

  afterEach(function () {
    restore();
  });

  test("Receipt throws without chain", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "receipt",
      "--privateKey",
      privateKey,
      "ignored",
      ...defaultArgs,
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "missing required flag (`-c` or `--chain`)");
  });

  test("Receipt throws with invalid chain", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "receipt",
      ...defaultArgs,
      "--privateKey",
      privateKey,
      "--chain",
      "foozbazz",
      "ignored",
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "unsupported chain (see `chains` command for details)");
  });

  test("throws with invalid tx hash", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(logger, "error");
    await yargs([
      "receipt",
      ...defaultArgs,
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
      "ignored",
    ])
      .command(mod)
      .parse();

    const value = consoleError.getCall(0).firstArg;
    equal(value, "Not Found");
  });

  test("Receipt passes with local-tableland", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleLog = spy(logger, "log");

    const { meta } = await db
      .prepare("update healthbot_31337_1 set counter=1;")
      .all();
    const hash = meta.txn?.transactionHash ?? "";

    equal(typeof hash, "string");
    equal(hash.length > 0, true);

    await yargs([
      "receipt",
      ...defaultArgs,
      "--privateKey",
      privateKey,
      "--chain",
      "local-tableland",
      hash,
    ])
      .command(mod)
      .parse();

    const res = consoleLog.getCall(0).firstArg;
    const value = JSON.parse(res);

    match(value.transactionHash, /0x[a-f0-9]+/i);
    equal(typeof value.tableId, "string");
    equal(typeof value.blockNumber, "number");
    equal(value.chainId, 31337);
  });
});
