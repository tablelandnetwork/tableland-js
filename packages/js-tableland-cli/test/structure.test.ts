import { describe, test, afterEach, before } from "mocha";
import { spy, restore, assert } from "sinon";
import yargs from "yargs/yargs";
import * as mod from "../src/commands/structure.js";

describe("commands/structure", function () {
  before(async function () {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(function () {
    restore();
  });

  test("throws with invalid chain", async function () {
    const consoleError = spy(console, "error");
    await yargs(["structure", "--chain", "blah", "output"])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleError,
      "unsupported chain (see `chains` command for details)"
    );
  });

  test("returns empty", async function () {
    const consoleLog = spy(console, "log");
    await yargs(["structure", "blah", "--chain", "local-tableland"])
      .command(mod)
      .parse();
    assert.calledWith(consoleLog, "[]");
  });

  test("passes with local-tableland", async function () {
    const consoleLog = spy(console, "log");
    const structure =
      "2f852efa05457a128810b4897bd845840b6a3e687dca0850f8260b5b0e930055";
    await yargs(["structure", structure, "--chain", "local-tableland"])
      .command(mod)
      .parse();
    assert.calledWith(
      consoleLog,
      `[
  {
    "controller": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "name": "healthbot_31337_1",
    "structure": "2f852efa05457a128810b4897bd845840b6a3e687dca0850f8260b5b0e930055"
  }
]`
    );
  });
});
