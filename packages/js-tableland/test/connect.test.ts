import fetch from "jest-fetch-mock";
import { Signer } from "ethers";
import { connect } from "../src/main";
import { ConnectionOptions } from "../src/interfaces";

describe("connect function", function () {
  beforeAll(async function () {
    // reset in case another test file hasn't cleaned up
    fetch.resetMocks();
  });

  afterEach(function () {
    // ensure mocks don't bleed into other tests
    fetch.resetMocks();
  });

  test("exposes signer with correct address", async function () {
    const connection = await connect({ network: "testnet", host: "https://testnet.tableland.network" });

    await expect(connection.signer.getAddress()).toMatch("testaddress");
  });

  test("exposes public methods and properties",  async function () {
    const connection = await connect({ network: "testnet", host: "https://testnet.tableland.network" });

    await expect(connection.network).toBe("testnet");
    await expect(connection.host).toBe("https://testnet.tableland.network");
    await expect(connection.token instanceof Object).toBe(true);
    await expect(typeof connection.token.token).toBe("string");
    await expect(connection.signer instanceof Object).toBe(true);
    await expect(typeof connection.list).toBe("function");
    await expect(typeof connection.query).toBe("function");
    await expect(typeof connection.create).toBe("function");
  });

  test("throws error if provider network is not supported", async function () {
    await expect(async function () {
      await connect({
        network: "testnet",
        host: "https://testnet.tableland.network",
        signer: {
          provider: {
            getNetwork: async function () {
              return { name: "ropsten", chainId: 1 };
            },
          } as any,
          getAddress: async function () {
            return "testaddress";
          },
          signMessage: async function () {
            return "testsignedmessage";
          }
        } as unknown as Signer // convince type checks into letting us mock the signer
      });
    } as ConnectionOptions).rejects.toThrow(
      "Only Ethereum Rinkeby network is currently supported. Switch your wallet connection and reconnect."
    );
  });
});