import { describe, test } from "mocha";
import { spy, assert, restore, match } from "sinon";
import yargs from "yargs/yargs";
import mockStd from "mock-stdin";
import { getAccounts } from "@tableland/local";
import * as mod from "../src/commands/shell.js";
import { wait } from "../src/utils.js";

describe("commands/shell", function () {
  this.timeout("30s");

  before(async function () {
    await wait(10000);
  });

  afterEach(function () {
    restore();
  });

  test("Shell Works with single line", async function () {
    const consoleDir = spy(console, "dir");
    const stdin = mockStd.stdin();

    setTimeout(() => {
      stdin.send("select * from healthbot_31337_1;\n").end();
    }, 1000);

    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    assert.calledWith(
      consoleDir,
      match((value) => {
        console.log(value);
        const res = value;
        return res.results[0].counter === 1;
      }, "Doesn't match expected output")
    );
  });

  test("Shell throws without chain", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(console, "error");
    await yargs(["shell", "--privateKey", privateKey]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "missing required flag (`-c` or `--chain`)"
    );
  });

  test("Shell throws with invalid chain", async function () {
    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    const consoleError = spy(console, "error");
    await yargs(["shell", "--privateKey", privateKey, "--chain", "foozbazz"])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleError,
      "unsupported chain (see `chains` command for details)"
    );
  });

  test("Custom baseUrl is called", async function () {
    const stdin = mockStd.stdin();
    const fetchSpy = spy(global, "fetch");

    setTimeout(() => {
      stdin.send("select * from\n").send("healthbot_31337_1;\n").end();
    }, 1000);

    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
      "--baseUrl",
      "https://localhost:8909",
    ])
      .command(mod)
      .parse();

    assert.calledWith(
      fetchSpy,
      match((v: any) => v.includes("https://localhost:8909/"))
    );
  });

  test("Shell Works with multi-line", async function () {
    const consoleDir = spy(console, "dir");
    const stdin = mockStd.stdin();

    setTimeout(() => {
      stdin.send("select * from\n").send("healthbot_31337_1;\n").end();
    }, 1000);

    const [account] = getAccounts();
    const privateKey = account.privateKey.slice(2);
    await yargs([
      "shell",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--privateKey",
      privateKey,
    ])
      .command(mod)
      .parse();

    assert.calledWith(
      consoleDir,
      match((value) => {
        console.log(value);
        const res = value;
        return res.results[0].counter === 1;
      }, "Doesn't match expected output")
    );
  });
});
