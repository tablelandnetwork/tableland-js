import { rejects, notEqual, strictEqual } from "assert";
import { describe, test } from "mocha";
import { getAccounts } from "@tableland/local";
import {
  extractBaseUrl,
  extractSigner,
  type ReadConfig,
  type SignerConfig,
  type Config,
} from "../src/helpers/config.js";
import {
  getDefaultProvider,
  getChainId,
  type Eip1193Provider,
} from "../src/helpers/index.js";
import { checkProvider } from "../src/helpers/ethers.js";
import { TEST_PROVIDER_URL, TEST_VALIDATOR_URL } from "./setup";

describe("config", function () {
  describe("extractBaseUrl()", function () {
    test("where baseUrl is explicitly provided", async function () {
      const conn: ReadConfig = { baseUrl: "baseUrl" };
      const extracted = await extractBaseUrl(conn);
      strictEqual(extracted, "baseUrl");
    });

    test("where baseUrl is obtained via the chainId", async function () {
      const [, wallet] = getAccounts();
      const signer = wallet.connect(getDefaultProvider(TEST_PROVIDER_URL));
      const conn: SignerConfig = { signer };
      const extracted = await extractBaseUrl(conn);
      strictEqual(extracted, TEST_VALIDATOR_URL);
    });

    test("where baseUrl is obtained via a fallback chainId", async function () {
      const chainNameOrId = getChainId("localhost");
      const conn: Config = {};
      const extracted = await extractBaseUrl(conn, chainNameOrId);
      strictEqual(extracted, TEST_VALIDATOR_URL);
    });

    test("where baseUrl cannot be extracted", async function () {
      const conn: Config = {};
      await rejects(extractBaseUrl(conn), (err: any) => {
        strictEqual(
          err.message,
          "missing connection information: baseUrl, signer, or chainId required"
        );
        return true;
      });
    });
  });
  describe("extractSigner()", function () {
    test("where signer is explicitly provided", async function () {
      const [, wallet] = getAccounts();
      const signer = wallet.connect(getDefaultProvider());
      const conn: SignerConfig = { signer };
      const extracted = await extractSigner(conn);
      strictEqual(await extracted.getAddress(), wallet.address);
    });

    test("where signer is obtained via an external provider", async function () {
      const [, wallet] = getAccounts();
      const conn: Config = {};
      // Mock RPC methods to work with `getSigner` calls within `extractSigner`
      const external = {
        request: async (request: {
          method: string;
          params?: any[];
        }): Promise<any> => {
          switch (request.method) {
            case "eth_requestAccounts":
              return [wallet.address];
            case "eth_accounts":
              return [wallet.address];
            default:
              throw new Error(
                `method ${request.method} not supported by the mock provider`
              );
          }
        },
      };
      const extracted = await extractSigner(conn, external);
      notEqual(await extracted.getAddress(), null);
      notEqual(extracted.provider, null);
    });

    test("where signer is obtained via an injected provider", async function () {
      const [, wallet] = getAccounts();
      const conn: Config = {};
      // Mock RPC methods to work with `getSigner` calls within `extractSigner`
      const ethereum: Eip1193Provider = {
        request: async (request: {
          method: string;
          params?: any[];
        }): Promise<any> => {
          switch (request.method) {
            case "eth_requestAccounts":
              return [wallet.address];
            case "eth_accounts":
              return [wallet.address];
            default:
              throw new Error(
                `method ${request.method} not supported by the mock provider`
              );
          }
        },
      };
      (globalThis as any).ethereum = ethereum;
      const extracted = await extractSigner(conn);
      checkProvider(extracted);
      notEqual(await extracted.getAddress(), null);
      notEqual(extracted.provider, null);
      delete (globalThis as any).ethereum;
    });

    test("where signer cannot be extracted", async function () {
      const conn: Config = {};
      await rejects(extractSigner(conn), (err: any) => {
        strictEqual(
          err.message,
          "provider error: missing global ethereum provider"
        );
        return true;
      });
    });
  });
});
