import { spawnSync } from "node:child_process";
import { join } from "node:path";
import path from "path";
import { getTableland } from "./util";
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

// NOTE: these tests require the a local Tableland is already running
describe("Validator, Chain, and SDK work end to end", function () {
  test("Create a table that can be read from", async function () {
    const signer = accounts[1];
    const tableland = await getTableland(signer);

    const prefix = "test_create_read";
    // `key` is a reserved word in sqlite
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix,
    });

    const chainId = 31337;

    const data = await tableland.read(
      `SELECT * FROM ${prefix}_${chainId}_${tableId};`
    );
    expect(data.rows).toEqual([]);
  });

  test("Create a table that can be written to", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_create_write";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix,
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
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix,
    });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    const data = await tableland.read(`SELECT * FROM ${queryableName};`);
    await expect(data.rows).toEqual([]);

    const signer2 = accounts[2];
    const tableland2 = await getTableland(signer2);

    await expect(async function () {
      await tableland2.write(
        `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
      );
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
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix,
    });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    const write1 = await tableland.write(
      `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
    );

    expect(typeof write1.hash).toEqual("string");

    const write2 = await tableland.write(
      `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'pine')`
    );

    expect(typeof write2.hash).toEqual("string");

    const data = await tableland.read(`SELECT * FROM ${queryableName};`);
    await expect(data.rows.length).toEqual(2);

    const delete1 = await tableland.write(
      `DELETE FROM ${queryableName} WHERE val = 'pine';`
    );

    expect(typeof delete1.hash).toEqual("string");

    const data2 = await tableland.read(`SELECT * FROM ${queryableName};`);
    await expect(data2.rows.length).toEqual(1);
  }, 30000);

  test("Read a table with `table` output", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_read";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix,
    });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    await tableland.write(
      `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
    );

    const data = await tableland.read(`SELECT * FROM ${queryableName};`, {
      output: "table",
    });

    await expect(data.columns).toEqual([{ name: "keyy" }, { name: "val" }]);
    await expect(data.rows).toEqual([["tree", "aspen"]]);
  });

  test("Read a table with `objects` output", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_read";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix,
    });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    await tableland.write(
      `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
    );

    const data = await tableland.read(`SELECT * FROM ${queryableName};`, {
      output: "objects",
    });

    await expect(data).toEqual([{ keyy: "tree", val: "aspen" }]);
  });

  test("Read a single row with `unwrap` option", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_read";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix,
    });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    await tableland.write(
      `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
    );

    const data = await tableland.read(`SELECT * FROM ${queryableName};`, {
      unwrap: true,
      output: "objects",
    });

    expect(data).toEqual({ keyy: "tree", val: "aspen" });
  });

  test("Read two rows with `unwrap` option fails", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_read";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix,
    });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    await tableland.write(
      `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
    );
    await tableland.write(
      `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'pine')`
    );

    await expect(async function () {
      await tableland.read(`SELECT * FROM ${queryableName};`, {
        unwrap: true,
        output: "objects",
      });
    }).rejects.toThrow(
      "unwrapped results with more than one row aren't supported in JSON RPC API"
    );
  });

  test("Read with `extract` option", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_read_extract";
    const { tableId } = await tableland.create("val TEXT", {
      prefix,
    });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    await tableland.write(
      `INSERT INTO ${queryableName} (val) VALUES ('aspen')`
    );
    await tableland.write(`INSERT INTO ${queryableName} (val) VALUES ('pine')`);

    const data = await tableland.read(`SELECT * FROM ${queryableName};`, {
      extract: true,
      output: "objects",
    });

    await expect(data).toEqual(["aspen", "pine"]);
  });

  test("Read table with two columns with `extract` option fails", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_read";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix,
    });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    await tableland.write(
      `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
    );

    await expect(async function () {
      await tableland.read(`SELECT * FROM ${queryableName};`, {
        extract: true,
        output: "objects",
      });
    }).rejects.toThrow(
      "can only extract values for result sets with one column but this has 2"
    );
  });

  test("List an account's tables", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_create_list";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix,
    });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    const tablesMeta = await tableland.list();

    await expect(Array.isArray(tablesMeta)).toEqual(true);
    const table = tablesMeta.find((table) => table.name === queryableName);

    await expect(table).toBeDefined();
    await expect(table.controller).toEqual(accounts[1].address);
  });

  test("write to a table without using the relay", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer, { rpcRelay: false });

    const prefix = "test_direct_write";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix,
    });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    const writeRes = await tableland.write(
      `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
    );

    expect(typeof writeRes.hash).toEqual("string");

    const data = await tableland.read(`SELECT * FROM ${queryableName};`);
    expect(data.rows).toEqual([["tree", "aspen"]]);
  });

  test("write without relay statement validates table name prefix", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer, { rpcRelay: false });

    const prefix = "test_direct_invalid_write";
    await tableland.create("keyy TEXT, val TEXT", { prefix });

    const prefix2 = "test_direct_invalid_write2";
    const { tableId } = await tableland.create("keyy TEXT, val TEXT", {
      prefix: prefix2,
    });

    // both tables owned by the same account
    // the prefix is for the first table, but id is for second table
    const queryableName = `${prefix}_31337_${tableId}`;

    await expect(async function () {
      await tableland.write(
        `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
      );
    }).rejects.toThrow(
      `table prefix doesn't match (exp ${prefix2}, got ${prefix})`
    );
  });

  test("write without relay statement validates table ID", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer, { rpcRelay: false });

    const prefix = "test_direct_invalid_id_write";
    await tableland.create("keyy TEXT, val TEXT", { prefix });

    // the tableId 0 does not exist since we start with tableId == 1
    const queryableName = `${prefix}_31337_0`;

    await expect(async function () {
      await tableland.write(
        `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
      );
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

    // Set the controller to Hardhat #7
    const { hash } = await tableland.setController(
      "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
      name
    );

    expect(typeof hash).toEqual("string");
    expect(hash.length).toEqual(66);
  });

  test("set controller with relay", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer, {
      rpcRelay: true /* this is default `true`, just being explicit */,
    });

    const prefix = "test_create_setcontroller_relay";
    // `key` is a reserved word in sqlite
    const { name } = await tableland.create("keyy TEXT, val TEXT", { prefix });

    // Set the controller to Hardhat #7
    const { hash } = await tableland.setController(
      "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
      name
    );

    expect(typeof hash).toEqual("string");
    expect(hash.length).toEqual(66);
  });

  test("get controller returns an address", async function () {
    const signer = accounts[1];

    const tableland = await getTableland(signer);

    const prefix = "test_create_getcontroller";
    // `key` is a reserved word in sqlite
    const { name } = await tableland.create("keyy TEXT, val TEXT", { prefix });

    // Hardhat #7
    const controllerAddress = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955";

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

    // Hardhat #7
    const controllerAddress = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955";

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
    const { tableId } = await tableland.create("a TEXT, b INT PRIMARY KEY", {
      prefix,
    });

    const chainId = 31337;
    const queryableName = `${prefix}_${chainId}_${tableId}`;

    const { structureHash } = await tableland.hash(
      "a TEXT, b INT PRIMARY KEY",
      { prefix }
    );

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
    const { tableId } = await tableland.create(
      "id TEXT, name TEXT, PRIMARY KEY(id)",
      {
        prefix,
      }
    );

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
