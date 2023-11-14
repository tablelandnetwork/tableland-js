import { strictEqual, throws } from "assert";
import { describe, test } from "mocha";
import {
  getBaseUrl,
  getChainInfo,
  getContractAddress,
  getChainId,
  isTestnet,
  type ChainName,
  supportedChains,
  overrideDefaults,
  getChainPollingController,
} from "../src/helpers/chains.js";
import { TEST_VALIDATOR_URL } from "./setup";

describe("chains", function () {
  describe("getBaseUrl()", function () {
    test("where we check some of the known defaults", function () {
      // We don't require a specific set because we don't want to have to update
      // these tests every time
      const localhost = "http://localhost:8081/api/v1";
      const testnets = "https://testnets.tableland.network/api/v1";
      const mainnet = "https://tableland.network/api/v1";
      strictEqual(getBaseUrl("localhost"), localhost);
      strictEqual(getBaseUrl("maticmum"), testnets);
      strictEqual(getBaseUrl("matic"), mainnet);
      strictEqual(getBaseUrl("optimism"), mainnet);
      strictEqual(getBaseUrl("mainnet"), mainnet);
    });
  });

  describe("getContractAddress()", function () {
    test("where we check the known default localhost contract address", async function () {
      const localhost = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
      const matic = "0x5c4e6A9e5C1e1BF445A062006faF19EA6c49aFeA";
      // Note we're checking local-tableland here, rather than localhost
      strictEqual(
        getContractAddress("local-tableland").toLowerCase(),
        localhost.toLowerCase()
      );
      strictEqual(
        getContractAddress("matic").toLowerCase(),
        matic.toLowerCase()
      );
    });
  });

  describe("isTestnet()", function () {
    test("where we make sure a testnet is correctly flagged", function () {
      const testnets: ChainName[] = [
        "sepolia",
        "arbitrum-sepolia",
        "maticmum",
        "optimism-goerli",
        "local-tableland",
        "localhost",
      ];
      const mainnets: ChainName[] = [
        "mainnet",
        "arbitrum",
        "matic",
        "optimism",
      ];
      for (const net of testnets) {
        strictEqual(isTestnet(net), true);
      }
      for (const net of mainnets) {
        strictEqual(isTestnet(net), false);
      }
    });
  });

  describe("supportedChains", function () {
    test("where we make sure supportedChains is a valid object", function () {
      strictEqual(Object.keys(supportedChains).length >= 12, true);
      strictEqual(Object.keys(supportedChains).includes("mainnet"), true);
      strictEqual(Object.keys(supportedChains).includes("maticmum"), true);
      strictEqual(Object.keys(supportedChains).includes("localhost"), true);
    });
  });

  describe("getChainId()", function () {
    test("where ensure we have a default set of chains with ids", function () {
      // Mainnets
      strictEqual(getChainId("mainnet"), 1);
      strictEqual(getChainId("homestead"), 1);
      strictEqual(getChainId("matic"), 137);
      strictEqual(getChainId("optimism"), 10);
      strictEqual(getChainId("arbitrum"), 42161);
      strictEqual(getChainId("arbitrum-nova"), 42170);
      strictEqual(getChainId("filecoin"), 314);
      // Testnets
      strictEqual(getChainId("sepolia"), 11155111);
      strictEqual(getChainId("maticmum"), 80001);
      strictEqual(getChainId("optimism-goerli"), 420);
      strictEqual(getChainId("arbitrum-sepolia"), 421614);
      strictEqual(getChainId("filecoin-calibration"), 314159);
      // Local
      strictEqual(getChainId("localhost"), 31337);
    });
  });

  describe("getChainInfo()", function () {
    test("where spot check a few chain info objects", function () {
      const localhostUrl = TEST_VALIDATOR_URL;
      const testnetsUrl = "https://testnets.tableland.network/api/v1";
      const mainnetUrl = "https://tableland.network/api/v1";

      const mainnet = getChainInfo("mainnet");
      strictEqual(mainnet.baseUrl, mainnetUrl);
      strictEqual(mainnet.chainId, 1);
      const localhost = getChainInfo("localhost");
      strictEqual(localhost.baseUrl, localhostUrl);
      strictEqual(localhost.chainId, 31337);
      const maticmum = getChainInfo("maticmum");
      strictEqual(maticmum.baseUrl, testnetsUrl);
      strictEqual(maticmum.chainId, 80001);
    });

    test("where it fails when invalid chain is passed", function () {
      // Should not exist for Optimism Goerli staging environment (filtered out)
      throws(
        () => getChainId("optimism-goerli-staging"),
        (err: any) => {
          strictEqual(
            err.message,
            "cannot use unsupported chain: optimism-goerli-staging"
          );
          return true;
        }
      );

      // Try some random chain ID
      throws(
        () => getChainId(999999999999),
        (err: any) => {
          strictEqual(
            err.message,
            "cannot use unsupported chain: 999999999999"
          );
          return true;
        }
      );
    });
  });

  describe("getChainPollingController()", function () {
    test("where we get polling controller with chain ids", async function () {
      const homesteadController = getChainPollingController(1); // mainnet
      const filecoinController = getChainPollingController(314); // filecoin
      const maticmumController = getChainPollingController(80001); // polygon mumbai
      const filecoinTestnetController = getChainPollingController(314159); // filecoin testnet
      const localController = getChainPollingController(31337); // local
      strictEqual(homesteadController.interval, 1500); // most should use the same 1500ms interval
      strictEqual(homesteadController.timeout, 40000); // but different timeouts
      strictEqual(filecoinController.interval, 5000); // filecoin has longer intervals
      strictEqual(filecoinController.timeout, 210000);
      strictEqual(maticmumController.interval, 1500);
      strictEqual(maticmumController.timeout, 15000);
      strictEqual(filecoinTestnetController.interval, 5000);
      strictEqual(filecoinTestnetController.timeout, 210000);
      strictEqual(localController.interval, 1500);
      strictEqual(localController.timeout, 5000);
      homesteadController.cancel();
      filecoinController.cancel();
      maticmumController.cancel();
      filecoinTestnetController.cancel();
      localController.cancel();
    });

    test("where we get polling controller with chain names", async function () {
      const homesteadController = getChainPollingController("homestead");
      const filecoinTestnetController = getChainPollingController(
        "filecoin-calibration"
      );
      const localController = getChainPollingController("local-tableland");
      strictEqual(homesteadController.interval, 1500);
      strictEqual(homesteadController.timeout, 40000);
      strictEqual(filecoinTestnetController.interval, 5000);
      strictEqual(filecoinTestnetController.timeout, 210000);
      strictEqual(localController.interval, 1500);
      strictEqual(localController.timeout, 5000);
      homesteadController.cancel();
      filecoinTestnetController.cancel();
      localController.cancel();
    });

    test("when called with invalid chain name or id", async function () {
      throws(
        // @ts-expect-error need to tell ts to ignore this since we are testing a failure when used without ts
        () => getChainPollingController("invalid"),
        (err: any) => {
          strictEqual(err.message, "cannot use unsupported chain: invalid");
          return true;
        }
      );
      throws(
        () => getChainPollingController(99999),
        (err: any) => {
          strictEqual(err.message, "cannot use unsupported chain: 99999");
          return true;
        }
      );
    });
  });

  describe("getChainPollingController()", function () {
    test("where we get polling controller with chain ids", async function () {
      const homesteadController = getChainPollingController(1); // mainnet
      const filecoinController = getChainPollingController(314); // filecoin
      const maticmumController = getChainPollingController(80001); // polygon mumbai
      const filecoinTestnetController = getChainPollingController(314159); // filecoin testnet
      const localController = getChainPollingController(31337); // local
      strictEqual(homesteadController.interval, 1500); // most should use the same 1500ms interval
      strictEqual(homesteadController.timeout, 40000); // but different timeouts
      strictEqual(filecoinController.interval, 5000); // filecoin has longer intervals
      strictEqual(filecoinController.timeout, 210000);
      strictEqual(maticmumController.interval, 1500);
      strictEqual(maticmumController.timeout, 15000);
      strictEqual(filecoinTestnetController.interval, 5000);
      strictEqual(filecoinTestnetController.timeout, 210000);
      strictEqual(localController.interval, 1500);
      strictEqual(localController.timeout, 5000);
      homesteadController.cancel();
      filecoinController.cancel();
      maticmumController.cancel();
      filecoinTestnetController.cancel();
      localController.cancel();
    });

    test("where we get polling controller with chain names", async function () {
      const homesteadController = getChainPollingController("homestead");
      const filecoinTestnetController = getChainPollingController(
        "filecoin-calibration"
      );
      const localController = getChainPollingController("local-tableland");
      strictEqual(homesteadController.interval, 1500);
      strictEqual(homesteadController.timeout, 40000);
      strictEqual(filecoinTestnetController.interval, 5000);
      strictEqual(filecoinTestnetController.timeout, 210000);
      strictEqual(localController.interval, 1500);
      strictEqual(localController.timeout, 5000);
      homesteadController.cancel();
      filecoinTestnetController.cancel();
      localController.cancel();
    });

    test("when called with invalid chain name or id", async function () {
      throws(
        // @ts-expect-error need to tell ts to ignore this since we are testing a failure when used without ts
        () => getChainPollingController("invalid"),
        (err: any) => {
          strictEqual(err.message, "cannot use unsupported chain: invalid");
          return true;
        }
      );
      throws(
        () => getChainPollingController(99999),
        (err: any) => {
          strictEqual(err.message, "cannot use unsupported chain: 99999");
          return true;
        }
      );
    });
  });

  describe("overrideDefaults()", function () {
    test("when called incorrectly", async function () {
      throws(
        // @ts-expect-error need to tell ts to ignore this since we are testing a failure when used without ts
        () => overrideDefaults("homestead"), // didn't pass in overrides
        (err: any) => {
          strictEqual(err.message, "override values must be an Object");
          return true;
        }
      );
    });
  });
});
