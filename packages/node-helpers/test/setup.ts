import { resolve } from "node:path";
import { after, before } from "mocha";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { LocalTableland } from "@tableland/local";
import { helpers } from "@tableland/sdk";

chai.use(chaiAsPromised);

const { overrideDefaults } = helpers;
const getTimeoutFactor = function (): number {
  const envFactor = Number(process.env.TEST_TIMEOUT_FACTOR);
  if (!isNaN(envFactor) && envFactor > 0) {
    return envFactor;
  }
  return 1;
};

// NOTE: Each test has it's own set of ports the network will run on.
//       This allows the tests to run in parallel on the same machine.
//       Look at test/validator/config.json for details.
const registryPort = 8548;

export const TEST_TIMEOUT_FACTOR = getTimeoutFactor();
export const TEST_PROVIDER_URL = `http://127.0.0.1:${registryPort}`;
export const TEST_VALIDATOR_URL = "http://localhost:8083/api/v1";

// this sets default values globally
overrideDefaults("local-tableland", { baseUrl: TEST_VALIDATOR_URL });
overrideDefaults("localhost", { baseUrl: TEST_VALIDATOR_URL });

const lt = new LocalTableland({
  validator: resolve(process.cwd(), "test", "validator"),
  registryPort,
  silent: true,
});

before(async function () {
  this.timeout(TEST_TIMEOUT_FACTOR * 40000);
  await lt.start();
});

after(async function () {
  await lt.shutdown();
});
