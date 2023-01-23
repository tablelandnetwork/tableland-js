import { describe, test, afterEach, before } from "mocha";
import { spy, restore, assert, match } from "sinon";
import yargs from "yargs/yargs";
import { temporaryWrite } from "tempy";
import mockStd from "mock-stdin";
import * as mod from "../src/commands/read.js";
import { wait } from "../src/utils.js";

describe("commands/read", function () {
  before(async function () {
    await wait(500);
  });

  afterEach(function () {
    restore();
  });

  test("throws with invalid chain", async function () {
    const consoleError = spy(console, "error");
    await yargs(["read", "select * from something;"]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "unsupported chain (see `chains` command for details)"
    );
  });

  test("throws with invalid statement", async function () {
    const consoleError = spy(console, "error");
    await yargs(["read", "invalid;", "--chain", "local-tableland"])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleError,
      "error parsing statement: syntax error at position 7 near 'invalid'"
    );
  });

  test("throws with missing file", async function () {
    const consoleError = spy(console, "error");
    await yargs(["read", "--file", "missing.sql", "--chain", "local-tableland"])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleError,
      match((value) => {
        return value.startsWith("ENOENT: no such file or directory");
      }, "Didn't throw ENOENT.")
    );
  });

  test("throws with empty stdin", async function () {
    const stdin = mockStd.stdin();
    const consoleError = spy(console, "error");
    process.nextTick(() => {
      stdin.send("\n").end();
    });
    await yargs(["read", "--chain", "local-tableland"]).command(mod).parse();
    assert.calledWith(
      consoleError,
      "missing input value (`statement`, `file`, or piped input from stdin required)"
    );
  });

  test("Read passes with local-tableland (defaults to table format)", async function () {
    const consoleLog = spy(console, "log");
    await yargs([
      "read",
      "select * from healthbot_31337_1",
      "--chain",
      "local-tableland",
    ])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleLog,
      match((value) => {
        const res = value;
        return res.results[0].counter === 1;
      }, "Doesn't match expected output")
    );
  });

  test("passes with alternate output format (objects)", async function () {
    const consoleLog = spy(console, "log");
    await yargs([
      "read",
      "select * from healthbot_31337_1;",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
    ])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleLog,
      match((value) => {
        const res = value;
        return res.results[0].counter === 1;
      }, "Doesn't match expected output")
    );
  });

  test("passes when provided input from file", async function () {
    const consoleLog = spy(console, "log");
    const path = await temporaryWrite("select * from healthbot_31337_1;\n");
    await yargs([
      "read",
      "--chain",
      "local-tableland",
      "--file",
      path,
      "--format",
      "objects",
    ])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleLog,
      match((value) => {
        const res = value;
        return res.results[0].counter === 1;
      }, "Doesn't match expected output")
    );
  });

  test("passes when provided input from stdin", async function () {
    const consoleLog = spy(console, "log");
    const stdin = mockStd.stdin();
    process.nextTick(() => {
      stdin.send("select * from healthbot_31337_1;\n").end();
    });
    await yargs([
      "read",
      "--chain",
      "local-tableland",
      "--format",
      "objects",
      "--providerUrl",
      "http://127.0.0.1:8545",
    ])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleLog,
      match((value) => {
        const res = value;
        return res.results[0].counter === 1;
      }, "Doesn't match expected output")
    );
  });

  test("Custom baseUrl is called", async function () {
    const fetchSpy = spy(global, "fetch");
    await yargs([
      "read",
      "select * from healthbot_31337_1;",
      "--chain",
      "local-tableland",
      "--format",
      "pretty",
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

  test.skip("passes with alternate output format (pretty)", async function () {
    const consoleLog = spy(console, "log");
    await yargs([
      "read",
      "select * from healthbot_31337_1;",
      "--chain",
      "local-tableland",
      "--format",
      "pretty",
    ])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleLog,
      `
┌─────────┬─────────┐
│ (index) │ counter │
├─────────┼─────────┤
│    0    │    1    │
└─────────┴─────────┘`.trimStart()
    );
  });
});
