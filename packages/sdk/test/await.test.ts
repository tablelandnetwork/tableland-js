import { match, rejects, strictEqual } from "assert";
import { describe, test } from "mocha";
import {
  type AsyncFunction,
  type PollingController,
  createPollingController,
  getAsyncPoller,
  createSignal,
} from "../src/helpers/await.js";
import { getDelay } from "../src/helpers/utils.js";

describe("await", function () {
  test("ensure default polling controller timeout and interval", function () {
    const controller = createPollingController();
    strictEqual(controller.timeout, 60000);
    strictEqual(controller.interval, 1500);
  });

  test("ensure custom polling controller timeout and interval", function () {
    const controller = createPollingController(999, 10);
    strictEqual(controller.timeout, 999);
    strictEqual(controller.interval, 10);
  });

  test("ensure polling stops after successful results", async function () {
    let callCount = 0;
    async function testPolling(
      controller: PollingController
    ): Promise<boolean> {
      let first = true;
      const fn: AsyncFunction<boolean> = async () => {
        callCount += 1;
        if (first) {
          first = false;
          return { done: false };
        }
        await getDelay(10);
        return { done: true, data: true };
      };
      return await getAsyncPoller(fn, controller);
    }
    await testPolling(createPollingController(10000, 100));
    strictEqual(callCount, 2);
  });

  test("ensure polling stops after timeout", async function () {
    async function testPolling(
      controller: PollingController
    ): Promise<boolean> {
      const fn: AsyncFunction<boolean> = async () => {
        return { done: false };
      };
      return await getAsyncPoller(fn, controller);
    }
    const controller = createPollingController(1000, 10);
    setTimeout(() => controller.abort(), 5);
    await rejects(testPolling(controller), (err: any) => {
      match(err.message, /Th(e|is) operation was aborted/);
      return true;
    });
  });

  test("createAbort returns a valid signal", async function () {
    // Check aborted flag
    const controller = createPollingController();
    strictEqual(controller.signal.aborted, false);
    controller.abort();
    strictEqual(controller.signal.aborted, true);
    // Check signal event listener
    const controller2 = createPollingController();
    strictEqual(controller2.signal.aborted, false);
    setTimeout(() => {
      controller2.abort();
    }, 1000);
    await new Promise<void>(function (resolve) {
      controller2.signal.addEventListener("abort", function abortListener() {
        controller2.signal.removeEventListener("abort", abortListener);
        resolve();
      });
    });
    strictEqual(controller2.signal.aborted, true);
  });

  test("createSignal should return valid signal", () => {
    const result = createSignal();
    strictEqual(typeof result, "object");
    strictEqual(typeof result.signal, "object");
    strictEqual(typeof result.abort, "function");
  });

  test("createSignal should set to aborted when called", () => {
    const result = createSignal();
    strictEqual(result.signal.aborted, false);
    result.abort();
    strictEqual(result.signal.aborted, true);
  });
});
