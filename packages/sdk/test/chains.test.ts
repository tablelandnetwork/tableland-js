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

    test("where we make sure a testnet is correctly flagged", function () {
      const testnets: ChainName[] = [
        "sepolia",
        "arbitrum-goerli",
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

    test("where we make sure supportedChains is a valid object", function () {
      strictEqual(Object.keys(supportedChains).length >= 12, true);
      strictEqual(Object.keys(supportedChains).includes("mainnet"), true);
      strictEqual(Object.keys(supportedChains).includes("maticmum"), true);
      strictEqual(Object.keys(supportedChains).includes("localhost"), true);
    });

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
      strictEqual(getChainId("arbitrum-goerli"), 421613);
      strictEqual(getChainId("filecoin-calibration"), 314159);
      // Local
      strictEqual(getChainId("localhost"), 31337);
    });

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
