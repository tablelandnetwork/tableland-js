import { type Server } from "node:net";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { describe, test } from "mocha";
import chai from "chai";
import { stub, restore, assert as sinonAssert } from "sinon";
import {
  checkPortInUse,
  getAccounts,
  getDatabase,
  getRegistryPort,
} from "../src/util.js";
import { LocalTableland } from "../src/main.js";
import {
  measureExecutionTime,
  startMockServer,
  stopMockServer,
} from "./util.js";

const expect = chai.expect;
const executionTimes: {
  start: number[];
  shutdown: number[];
} = {
  start: [],
  shutdown: [],
};

describe("startup and shutdown", function () {
  let server: Server | undefined;
  let lt: LocalTableland | undefined;
  const defaultPort = 8545; // Used for hardhat

  this.timeout(30000); // Starting up LT takes 3000-7000ms; shutting down takes <10-10000ms
  afterEach(async function () {
    restore();
    // Ensure all processes are cleaned up after each test
    if (server != null) {
      await stopMockServer(server);
      server = undefined;
    }
    // Ensure both validator and registry haven't already been shut down & cleaned up
    // before attempting to shut them down
    if (lt?.validator !== undefined && lt?.registry !== undefined) {
      const shutdownExecutionTime = await measureExecutionTime(
        async () => await lt?.shutdown()
      );
      executionTimes.shutdown.push(shutdownExecutionTime);
      lt = undefined;
    }
  });

  test("successfully starts and shuts down", async function () {
    lt = new LocalTableland({ silent: true });
    const startupExecutionTime = await measureExecutionTime(
      async () => await lt?.start()
    );
    executionTimes.start.push(startupExecutionTime);
    expect(lt.validator).to.not.equal(undefined);
    expect(lt.registry).to.not.equal(undefined);

    const shutdownExecutionTime = await measureExecutionTime(
      async () => await lt?.shutdown()
    );
    executionTimes.shutdown.push(shutdownExecutionTime);
    expect(lt.validator).to.be.equal(undefined);
    expect(lt.registry).to.be.equal(undefined);
  });

  test("fails to start due to port 8545 in use", async function () {
    lt = new LocalTableland({ silent: true });
    // Start a server on port 8545 to block Local Tableland from using it
    server = await startMockServer(defaultPort);
    // Check if it is in use
    const portInUse = await checkPortInUse(defaultPort);
    expect(portInUse).to.equal(true);

    // Local Tableland should not start successfully
    // No `measureExecutionTime` wrapper needed
    await expect(
      (async function () {
        await lt.start();
      })()
    ).to.be.rejectedWith(`port ${defaultPort} already in use`);
  });

  test("fails to start due to registry deploy failure", async function () {
    const lt = new LocalTableland({ silent: true });
    // note: need to cast as `any` since the method is private
    const deployStub = stub(lt, "_deployRegistry" as any);

    // Try to start Local Tableland, which will attempt to use `customPort` and fail
    await expect(
      (async function () {
        await lt.start();
      })()
    ).to.be.rejectedWith(
      "deploying registry contract failed, cannot start network"
    );

    sinonAssert.calledOnce(deployStub);
    restore();
  });

  describe("with custom registryPort", function () {
    test("successfully starts and works with SDK", async function () {
      const customPort = 9999;
      lt = new LocalTableland({
        silent: false,
        registryPort: customPort,
      });
      // Make sure it is not in use
      const portInUse = await checkPortInUse(customPort);
      expect(portInUse).to.equal(false);

      // Local Tableland should start successfully on custom Registry port
      const startupExecutionTime = await measureExecutionTime(
        async () => await lt?.start()
      );
      executionTimes.start.push(startupExecutionTime);
      const ltPort = getRegistryPort(lt);
      expect(ltPort).to.equal(customPort);

      // Should still be able to use SDK
      const accounts = getAccounts(lt);
      expect(accounts.length).to.equal(20);
      const signer = accounts[1];
      const db = getDatabase(signer);
      const { meta } = await db
        .prepare(`CREATE TABLE test_registry (id INT);`)
        .run();
      const tableName = meta.txn?.name ?? "";
      expect(tableName).to.match(/^test_registry_31337_\d+$/);
    });

    test("successfully start by overwriting validator config and reset config on shutdown", async function () {
      const customPort = 9999;
      lt = new LocalTableland({
        silent: true,
        registryPort: customPort,
      });
      // Make sure it is not in use
      const portInUse = await checkPortInUse(customPort);
      expect(portInUse).to.equal(false);

      // Local Tableland should start successfully on custom Registry port
      const startupExecutionTime = await measureExecutionTime(
        async () => await lt?.start()
      );
      executionTimes.start.push(startupExecutionTime);
      const ltPort = getRegistryPort(lt);
      expect(ltPort).to.equal(customPort);

      // Config file should have been updated to use custom port 9999
      const configFilePath = join(
        lt.validator?.validatorDir ?? "",
        "config.json"
      );
      let configFile = readFileSync(configFilePath);
      let validatorConfig = JSON.parse(configFile.toString());
      expect(validatorConfig.Chains[0].Registry.EthEndpoint).to.equal(
        `ws://localhost:${ltPort}`
      );

      // Shut down Local Tableland and ensure validator config file is reset
      const shutdownExecutionTime = await measureExecutionTime(
        async () => await lt?.shutdown()
      );
      executionTimes.shutdown.push(shutdownExecutionTime);
      configFile = readFileSync(configFilePath);
      validatorConfig = JSON.parse(configFile.toString());
      expect(validatorConfig.Chains[0].Registry.EthEndpoint).to.equal(
        `ws://localhost:8545`
      );
    });

    test("fails to start due to custom port in use", async function () {
      const customPort = 9999;
      lt = new LocalTableland({ silent: true, registryPort: customPort });
      // Start a server on `customPort` to block Local Tableland from using it
      server = await startMockServer(customPort);
      // Check if it is in use
      const portInUse = await checkPortInUse(customPort);
      expect(portInUse).to.equal(true);
      // Try to start Local Tableland, which will attempt to use `customPort` and fail
      await expect(
        (async function () {
          await lt.start();
        })()
      ).to.be.rejectedWith(`port ${customPort} already in use`);
      // Ensure Local Tableland subprocesses did not start and/or are not hanging
      expect(lt.validator).to.equal(undefined);
      expect(lt.registry).to.equal(undefined);
    });
  });
});
