import { providers } from "ethers";
import { jest } from "@jest/globals";
import path from "path";
import {
  testRpcResponse,
  testHttpResponse,
  getTableland,
  loadSpecTestData,
  getAccounts,
} from "./utils";

const __dirname = path.resolve(path.dirname(""));

// These tests take a bit longer than normal since we are usually waiting for blocks to finalize etc...
jest.setTimeout(25000);
const accounts = getAccounts();

// NOTE: these tests require the a local Tableland is already running
describe("Validator, Chain, and SDK work end to end", function () {
  test("Create a table that can be read from", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_create_read";
    // `key` is a reserved word in sqlite
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix
    });

    const chainId = 31337;

    const data = await tableland.read(
      `SELECT * FROM ${prefix}_${chainId}_${tableId};`
    );
    await expect(data.rows).toEqual([]);
  });

  test("Create a table that can be written to", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_create_write";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix
    });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    const writeRes = await tableland.write(
      `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
    );

    const data = await tableland.read(`SELECT * FROM ${queryableName};`);

    await expect(typeof writeRes.hash).toEqual("string");
    await expect(data.rows).toEqual([["tree", "aspen"]]);
  });

  test("Table cannot be written to unless caller is allowed", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_not_allowed";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", { prefix });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    const data = await tableland.read(`SELECT * FROM ${queryableName};`);
    await expect(data.rows).toEqual([]);

    const signer2 = accounts[2];
    const tableland2 = await getTableland(signer2);
    
    await expect(async function () {
      await tableland2.write(`INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`);
    }).rejects.toThrow(
      "db query execution failed (code: ACL, msg: not enough privileges)"
    );

    const data2 = await tableland2.read(`SELECT * FROM ${queryableName};`);
    await expect(data2.rows).toEqual([]);
  });

  test("Create a table can have a row deleted", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_create_delete";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", { prefix });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    const write1 = await tableland.write(`INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`);

    expect(typeof write1.hash).toEqual("string");

    const write2 = await tableland.write(`INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'pine')`);

    expect(typeof write2.hash).toEqual("string");

    const data = await tableland.read(`SELECT * FROM ${queryableName};`);
    await expect(data.rows.length).toEqual(2);

    const delete1 = await tableland.write(`DELETE FROM ${queryableName} WHERE val = 'pine';`);

    expect(typeof delete1.hash).toEqual("string");

    const data2 = await tableland.read(`SELECT * FROM ${queryableName};`);
    await expect(data2.rows.length).toEqual(1);
  }, 30000);

  test("List an account's tables", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_create_list";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", { prefix });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    const tablesMeta = await tableland.list();

    await expect(Array.isArray(tablesMeta)).toEqual(true);
    const table = tablesMeta.find(table => table.name === queryableName);

    await expect(table).toBeDefined();
    await expect(table.controller).toEqual(accounts[1].address);
  });

  test("write to a table without using the relay", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer, {rpcRelay: false});

    const prefix = "test_direct_write";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", { prefix });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    const writeRes = await tableland.write(`INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`);

    expect(typeof writeRes.hash).toEqual("string");

    const data = await tableland.read(`SELECT * FROM ${queryableName};`);
    await expect(data.rows).toEqual([["tree", "aspen"]]);
  });

  test("write without relay statement validates table name prefix", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer, {rpcRelay: false});

    const prefix = "test_direct_invalid_write";
    await tableland.create("keyy TEXT, val TEXT", { prefix });

    const prefix2 = "test_direct_invalid_write2"
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", { prefix: prefix2 });

    // both tables owned by the same account
    // the prefix is for the first table, but id is for second table
    const queryableName = `${prefix}_31337_${tableId}`;

    await expect(async function () {
      await tableland.write(`INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`);
    }).rejects.toThrow(
      `table prefix doesn't match (exp ${prefix2}, got ${prefix})`
    );
  });

  test("write without relay statement validates table ID", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer, {rpcRelay: false});

    const prefix = "test_direct_invalid_id_write";
    await tableland.create("keyy TEXT, val TEXT", { prefix });

    // the tableId 0 does not exist since we start with tableId == 1
    const queryableName = `${prefix}_31337_0`;

    await expect(async function () {
      await tableland.write(`INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`);
    }).rejects.toThrow(
      `getting table: failed to get the table: sql: no rows in result set`
    );
  });

  test("set controller without relay", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer, { rpcRelay: false });

    const prefix = "test_create_setcontroller_norelay";
    // `key` is a reserved word in sqlite
    const { name } = await tableland.create("keyy TEXT, val TEXT", { prefix });

    const chainId = 31337;

    // Set the controller to Hardhat #7
    const { hash } = await tableland.setController("0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", name);

    expect(typeof hash).toEqual("string");
    expect(hash.length).toEqual(66);
  });

  test("set controller with relay", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer, {
      rpcRelay: true /* this is default `true`, just being explicit */
    });

    const prefix = "test_create_setcontroller_relay";
    // `key` is a reserved word in sqlite
    const { name } = await tableland.create("keyy TEXT, val TEXT", { prefix });

    const chainId = 31337;

    // Set the controller to Hardhat #7
    const { hash } = await tableland.setController("0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", name);

    expect(typeof hash).toEqual("string");
    expect(hash.length).toEqual(66);
  });

  test("get controller returns an address", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_create_getcontroller";
    // `key` is a reserved word in sqlite
    const { name } = await tableland.create("keyy TEXT, val TEXT", { prefix });

    const chainId = 31337;
    // Hardhat #7
    const controllerAddress = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"

    const { hash } = await tableland.setController(controllerAddress, name);

    expect(typeof hash).toEqual("string");
    expect(hash.length).toEqual(66);

    const controller = await tableland.getController(name);

    expect(controller).toEqual(controllerAddress);
  });

  test("lock controller without relay returns a transaction hash", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer, { rpcRelay: false });

    const prefix = "test_create_lockcontroller";
    // `key` is a reserved word in sqlite
    const { name } = await tableland.create("keyy TEXT, val TEXT", { prefix });

    const chainId = 31337;
    // Hardhat #7
    const controllerAddress = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"

    const { hash } = await tableland.setController(controllerAddress, name);

    expect(typeof hash).toEqual("string");
    expect(hash.length).toEqual(66);

    const tx = await tableland.lockController(name);

    expect(typeof tx.hash).toEqual("string");
  });

  test("get the schema for a table", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_get_schema";
    const { tableId } = await tableland.create("a INT PRIMARY KEY", { prefix });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    const tableSchema = await tableland.schema(queryableName);

    expect(typeof tableSchema.columns).toEqual("object");
    expect(Array.isArray(tableSchema.table_constraints)).toEqual(true);
    expect(tableSchema.columns.length).toEqual(1);
    expect(tableSchema.columns[0].name).toEqual("a");
    expect(tableSchema.columns[0].type).toEqual("int");
    expect(Array.isArray(tableSchema.columns[0].constraints)).toEqual(true);
    expect(tableSchema.columns[0].constraints[0]).toEqual("PRIMARY KEY");
  });

  test("get the structure for a hash", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_get_structure";
    const { tableId } = await tableland.create("a TEXT, b INT PRIMARY KEY", { prefix });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    const { structureHash } = await tableland.hash("a TEXT, b INT PRIMARY KEY", { prefix });

    const tableStructure = await tableland.structure(structureHash);

    expect(Array.isArray(tableStructure)).toEqual(true);

    const lastStructure = tableStructure[tableStructure.length - 1];

    expect(lastStructure.name).toEqual(queryableName);
    expect(lastStructure.controller).toEqual(accounts[1].address);
    expect(lastStructure.structure).toEqual(structureHash);
  });

  test("A write that violates table constraints throws error", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_create_tc_violation";
    const { tableId } = await tableland.create("id TEXT, name TEXT, PRIMARY KEY(id)", {
      prefix
    });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    await expect(async function () {
      await tableland.write(
        `INSERT INTO ${queryableName} VALUES (1, '1'), (1, '1')`
      );
    }).rejects.toThrow(
      `db query execution failed (code: SQLITE_UNIQUE constraint failed: ${queryableName}.id, msg: UNIQUE constraint failed: ${queryableName}.id)`
    );
  });

});

describe("Validator gateway server", function () {
  let token, transactionHash, tableHash, schemaTableId;
  beforeAll(async function () {
    // TODO: split openapi spec tests and js tests into different files and npm commands,
    //       then `npm test` can run everything.
    const signer0 = accounts[0];
    const tableland0 = await getTableland(signer0);
    await tableland0.siwe();

    // We can"t use the Validator's Wallet to create tables because the Validator's nonce tracking will get out of sync
    const signer1 = accounts[1];
    const tableland1 = await getTableland(signer1);

    const prefix = "test_transaction";
    const { txnHash, tableId } = await tableland1.create("keyy TEXT, val TEXT", { prefix });

    const { tableId: tableId2 } = await tableland1.create("a INT PRIMARY KEY, CHECK (a > 0)", { prefix: "test_schema_route" });
    schemaTableId = tableId2;

    const { structureHash } = await tableland1.hash("a INT PRIMARY KEY", { prefix: "test_schema_route" });
    tableHash = structureHash;

    const chainId = 31337;

    const data = await tableland1.read(`SELECT * FROM ${prefix}_${chainId}_${tableId};`);
    await expect(data.rows).toEqual([]);

    // We need the token and a transaction hash for a transaction on the Hardhat chain,
    // to run the tests for the openapi spec file so we hoist them here..
    token = tableland0.token.token;
    transactionHash = txnHash;
  });

  const tests = loadSpecTestData(path.join(__dirname, "tmp", "tableland-openapi-spec.yaml"));

  test.each(tests)("$name", async function (_test) {
    const payload = {
      method: _test.methodName.toUpperCase(),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    };

    const routeTemplateData = {
      chainID: 31337,
      id: 1,
      address: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // Hardhat #1
      readStatement: "SELECT * FROM healthbot_31337_1",
      tableName: `test_schema_route_31337_${schemaTableId}`,
      hash: tableHash
    };

    // Cannot have a body on a GET/HEAD request
    if (_test.body) {
      // For some of the example requests we need to inject values for the chain tests are using
      if (_test.body.params && _test.body.params[0].txn_hash) _test.body.params[0].txn_hash = transactionHash;
      payload.body = JSON.stringify(_test.body);
    }

    const route = _test.route(routeTemplateData)
    const res = await fetch(`${_test.host}${route}`, payload);

    expect(typeof _test.response).not.toEqual("undefined");

    if (route === "/rpc") return await testRpcResponse(res, _test);
    await testHttpResponse(res, _test.response)
  });
});


