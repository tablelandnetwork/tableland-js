import { spawnSync } from "node:child_process";
import { join } from "node:path";
import path from "path";
import {
  testRpcResponse,
  testHttpResponse,
  getTableland,
  loadSpecTestData,
} from "./util";
import { getAccounts } from "../src/util";

const __dirname = path.resolve(path.dirname(""));
// TODO: we were using these tests to check the validator's OAS spec via
// copy copying the file during local tableland startup. Now that is a dev
// product, these kind of tests need to be separated
spawnSync("mkdir", ["./tmp"]);
spawnSync("cp", [
  join(__dirname, "../go-tableland", "tableland-openapi-spec.yaml"),
  "./tmp",
]);

// These tests take a bit longer than normal since we are usually waiting for blocks to finalize etc...
jest.setTimeout(25000);
const accounts = getAccounts();

describe("Validator gateway server", function () {
  let token, transactionHash, tableHash, schemaTableId, controllerTableId;
  beforeAll(async function () {
    // TODO: split openapi spec tests and js tests into different files and npm commands,
    //       then `npm test` can run everything.
    const signer0 = accounts[10];
    const tableland0 = await getTableland(signer0);
    await tableland0.siwe();

    // We can"t use the Validator's Wallet to create tables because the Validator's nonce tracking will get out of sync
    const signer1 = accounts[11];
    const tableland1 = await getTableland(signer1);

    const prefix = "test_transaction";
    const { txnHash, tableId } = await tableland1.create(
      "keyy TEXT, val TEXT",
      { prefix }
    );

    const chainId = 31337;

    const data = await tableland1.read(
      `SELECT * FROM ${prefix}_${chainId}_${tableId};`
    );
    await expect(data.rows).toEqual([]);

    const { tableId: tableId2 } = await tableland1.create(
      "a INT PRIMARY KEY, CHECK (a > 0)",
      {
        prefix: "test_schema_route",
      }
    );
    schemaTableId = tableId2.toString();

    const { tableId: tableId3 } = await tableland0.create(
      "a INT PRIMARY KEY, CHECK (a > 0)",
      {
        prefix: "test_setcontroller",
      }
    );
    controllerTableId = tableId3.toString();

    const { structureHash } = await tableland1.hash("a INT PRIMARY KEY", {
      prefix: "test_schema_route",
    });
    tableHash = structureHash;

    // We need the token and a transaction hash for a transaction on the Hardhat chain,
    // to run the tests for the openapi spec file so we hoist them here..
    token = tableland0.token.token;
    transactionHash = txnHash;
  });

  const tests = loadSpecTestData(
    path.join(__dirname, "tmp", "tableland-openapi-spec.yaml")
  );

  test.each(tests)("$name", async function (_test) {
    const payload = {
      method: _test.methodName.toUpperCase(),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    };

    const routeTemplateData = {
      chainID: 31337,
      id: 1,
      address: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // Hardhat #1
      readStatement: "SELECT * FROM healthbot_31337_1",
      tableName: `test_schema_route_31337_${schemaTableId}`,
      hash: tableHash,
    };

    // Cannot have a body on a GET/HEAD request
    if (_test.body) {
      // For some of the example requests we need to inject values for the chain tests are using
      if (_test.body.params && _test.body.params[0].txn_hash) {
        _test.body.params[0].txn_hash = transactionHash;
      }
      if (_test.body.method === "tableland_setController") {
        _test.body.params[0].token_id = controllerTableId;
      }
      payload.body = JSON.stringify(_test.body);
    }

    const route = _test.route(routeTemplateData);
    const res = await fetch(`${_test.host}${route}`, payload);

    expect(typeof _test.response).not.toEqual("undefined");

    if (route === "/rpc") return await testRpcResponse(res, _test);
    await testHttpResponse(res, _test.response);
  });
});
