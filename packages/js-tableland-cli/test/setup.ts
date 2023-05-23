import { after, before } from "mocha";
import { LocalTableland } from "@tableland/local";
import fetch, { Headers, Request, Response } from "node-fetch";

if (!globalThis.fetch) {
  (globalThis as any).fetch = fetch;
  (globalThis as any).Headers = Headers;
  (globalThis as any).Request = Request;
  (globalThis as any).Response = Response;
}

// TODO: most tests rely on a spy on the global `console.log`. This means we must
//    use silent: true here.  As an alternative we could explore using a `logger`
//    that can be mocked, or spied on, or expose an extension api depending on the test.
const lt = new LocalTableland({ silent: true });

before(async function () {
  this.timeout(30000);
  lt.start();
  await lt.isReady();
});

after(async function () {
  await lt.shutdown();
});
