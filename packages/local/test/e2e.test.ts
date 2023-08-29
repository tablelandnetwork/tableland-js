import { describe, after, before, test } from "mocha";
import chai from "chai";
import {
  getAccounts,
  getDatabase,
  getRegistry,
  getValidator,
} from "../src/util.js";
import { LocalTableland } from "../src/main.js";

const expect = chai.expect;
const localTablelandChainId = 31337;

describe("network end to end", function () {
  const lt = new LocalTableland({
    silent: true,
  });
  const accounts = getAccounts();

  // These tests take a bit longer than normal since we are running them against an actual network
  this.timeout(30000);
  before(async function () {
    await lt.start();
  });

  after(async function () {
    await lt.shutdown();
  });

  test("creates a table that can be read from", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);

    // `key` is a reserved word in sqlite.
    const res = await db.exec(
      `CREATE TABLE test_create_read (keyy TEXT, val TEXT);`
    );

    const data = await db
      .prepare(`SELECT * FROM ${res.meta.txn?.name as string};`)
      .all();
    expect(data.results).to.eql([]);
  });

  test("create a table that can be written to", async function () {
    this.timeout(50000);
    const signer = accounts[1];
    const db = getDatabase(signer);

    const { meta: createMetadata } = await db
      .prepare("CREATE TABLE test_create_write (keyy TEXT, val TEXT);")
      .run();

    const tableName = createMetadata.txn?.name ?? "";
    expect(tableName).to.match(/^test_create_write_31337_\d+$/);

    const insertRes = await db
      .prepare(`INSERT INTO ${tableName} (keyy, val) VALUES ('tree', 'aspen');`)
      .run();

    expect(insertRes.success).to.eql(true);
    expect(typeof insertRes.meta.duration).to.eql("number");

    const readRes = await db.prepare(`SELECT * FROM ${tableName};`).all();

    expect(readRes.results).to.eql([{ keyy: "tree", val: "aspen" }]);
  });

  test("table cannot be written to unless caller is allowed", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);

    const { meta: createMetadata } = await db
      .prepare("CREATE TABLE test_not_allowed (keyy TEXT, val TEXT);")
      .run();
    const queryableName = createMetadata.txn?.name ?? "";

    const data = await db.prepare(`SELECT * FROM ${queryableName};`).all();

    expect(data.results).to.eql([]);

    const signer2 = accounts[2];
    const db2 = getDatabase(signer2);

    await expect(
      (async function () {
        await db2
          .prepare(
            `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
          )
          .all();
      })()
    ).to.be.rejectedWith(
      // TODO: the old error was "db query execution failed (code: ACL, msg: not enough privileges)"
      //       we now get "ALL_ERROR", which is not very helpful in understanding what went wrong.
      "ALL_ERROR"
    );

    const data2 = await db2.prepare(`SELECT * FROM ${queryableName};`).all();
    expect(data2.results).to.eql([]);
  });

  test("create a table can have a row deleted", async function () {
    this.timeout(30000);
    const signer = accounts[1];
    const db = getDatabase(signer);

    const { meta: createMetadata } = await db
      .prepare("CREATE TABLE test_create_delete (keyy TEXT, val TEXT);")
      .run();
    const queryableName = createMetadata.txn?.name ?? "";

    const write1 = await db
      .prepare(
        `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
      )
      .all();

    expect(typeof write1.meta.txn?.transactionHash).to.eql("string");

    const write2 = await db
      .prepare(
        `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'pine')`
      )
      .all();

    expect(typeof write2.meta.txn?.transactionHash).to.eql("string");

    const data = await db.prepare(`SELECT * FROM ${queryableName};`).all();
    expect(data.results.length).to.eql(2);

    const delete1 = await db
      .prepare(`DELETE FROM ${queryableName} WHERE val = 'pine';`)
      .all();

    expect(typeof delete1.meta.txn?.transactionHash).to.eql("string");

    const data2 = await db.prepare(`SELECT * FROM ${queryableName};`).all();
    expect(data2.results.length).to.eql(1);
  });

  // TODO: make this a test for some kind of results formatting function
  //       assuming that is still appropriate
  test("read via `raw` method returns data with `table` output", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);

    const { meta: createMetadata } = await db
      .prepare("CREATE TABLE test_read (keyy TEXT, val TEXT);")
      .run();
    const queryableName = createMetadata.txn?.name ?? "";

    await db
      .prepare(
        `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
      )
      .all();

    const data = await db.prepare(`SELECT * FROM ${queryableName};`).raw();

    expect(data).to.eql([["tree", "aspen"]]);
  });

  test("count rows in a table", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);

    const { meta: createMetadata } = await db
      .prepare("CREATE TABLE test_count (keyy TEXT, val TEXT);")
      .run();
    const queryableName = createMetadata.txn?.name ?? "";

    await db
      .prepare(
        `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
      )
      .all();

    await db
      .prepare(
        `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'pine')`
      )
      .all();

    const data = await db
      .prepare(`SELECT COUNT(*) FROM ${queryableName};`)
      .all();

    expect(data.results).to.eql([{ "count(*)": 2 }]);
  });

  test("read a single row with `first` method", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);

    const { meta: createMetadata } = await db
      .prepare("CREATE TABLE test_read (keyy TEXT, val TEXT);")
      .run();
    const queryableName = createMetadata.txn?.name ?? "";

    await db
      .prepare(
        `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
      )
      .all();

    await db
      .prepare(
        `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'pine')`
      )
      .all();

    const data = await db.prepare(`SELECT * FROM ${queryableName};`).first();

    expect(data).to.eql({ keyy: "tree", val: "aspen" });
  });

  test("list an account's tables", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);
    const registry = getRegistry(signer);

    const { meta: createMetadata } = await db
      .prepare("CREATE TABLE test_create_list (keyy TEXT, val TEXT);")
      .run();
    const tableId = createMetadata.txn?.tableId ?? "";

    const tablesMeta = await registry.listTables();

    expect(Array.isArray(tablesMeta)).to.eql(true);
    const table = tablesMeta.find((table) => table.tableId === tableId);

    expect(typeof table).to.equal("object");
    expect(table?.chainId).to.eql(localTablelandChainId);
  });

  test("write statement validates table name prefix", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);

    const prefix1 = "test_direct_invalid_write";
    await db.prepare(`CREATE TABLE ${prefix1} (keyy TEXT, val TEXT);`).run();

    const { meta: createMetadata2 } = await db
      .prepare("CREATE TABLE test_direct_invalid_write2 (keyy TEXT, val TEXT);")
      .run();
    const tableId2 = createMetadata2.txn?.tableId ?? "";

    // both tables owned by the same account
    // the prefix is for the first table, but id is for second table
    const invalidName = `${prefix1}_${localTablelandChainId}_${tableId2}`;

    await expect(
      (async function () {
        await db
          .prepare(
            `INSERT INTO ${invalidName} (keyy, val) VALUES ('tree', 'aspen')`
          )
          .all();
      })()
    ).to.be.rejectedWith(
      // TODO: old error was `calling ValidateWriteQuery: table prefix doesn't match (exp ${prefix2}, got ${prefix1})`
      //       the new error message isn't very informative
      "ALL_ERROR"
    );
  });

  test("write statement validates table ID", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);

    const prefix = "test_direct_invalid_id_write";
    await db.prepare(`CREATE TABLE ${prefix} (keyy TEXT, val TEXT);`).run();

    // the tableId 0 does not exist since we start with tableId == 1
    const queryableName = `${prefix}_${localTablelandChainId}_0`;

    await expect(
      (async function () {
        await db
          .prepare(
            `INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`
          )
          .all();
      })()
    ).to.be.rejectedWith(
      // TODO: old error was `getting table: failed to get the table: sql: no rows in result set`
      //       the new error message isn't very informative
      "ALL_ERROR"
    );
  });

  test("allows setting controller", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);
    const registry = getRegistry(signer);

    const { meta: createMetadata } = await db
      .prepare("CREATE TABLE test_set_controller (keyy TEXT, val TEXT);")
      .run();
    const tableName = createMetadata.txn?.name ?? "";

    const { hash } = await registry.setController({
      // Set the controller to Hardhat #7
      controller: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
      tableName,
    });

    expect(typeof hash).to.eql("string");
    expect(hash.length).to.eql(66);
  });

  test("get controller returns an address", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);
    const registry = getRegistry(signer);

    const { meta: createMetadata } = await db
      .prepare("CREATE TABLE test_create_getcontroller (keyy TEXT, val TEXT);")
      .run();
    const tableName = createMetadata.txn?.name ?? "";

    // Hardhat #7
    const controllerAddress = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955";

    const { hash } = await registry.setController({
      controller: controllerAddress,
      tableName,
    });

    expect(typeof hash).to.eql("string");
    expect(hash.length).to.eql(66);

    const controller = await registry.getController(tableName);

    expect(controller).to.eql(controllerAddress);
  });

  test("lock controller returns a transaction hash", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);
    const registry = getRegistry(signer);

    const { meta: createMetadata } = await db
      .prepare("CREATE TABLE test_create_lockcontroller (keyy TEXT, val TEXT);")
      .run();
    const tableName = createMetadata.txn?.name ?? "";

    // Hardhat #7
    const controllerAddress = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955";

    const { hash } = await registry.setController({
      controller: controllerAddress,
      tableName,
    });

    expect(typeof hash).to.eql("string");
    expect(hash.length).to.eql(66);

    const tx = await registry.lockController(tableName);

    expect(typeof tx.hash).to.eql("string");
  });

  test("get the schema for a table", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);
    const validator = getValidator();

    const { meta: createMetadata } = await db
      .prepare("CREATE TABLE test_get_schema (keyy TEXT, val TEXT);")
      .run();
    const tableId = createMetadata.txn?.tableId ?? "";
    const tableName = createMetadata.txn?.name ?? "";

    const table = await validator.getTableById({
      chainId: localTablelandChainId,
      tableId,
    });

    expect(Array.isArray(table.schema.columns)).to.eql(true);
    expect(table.schema.columns.length).to.eql(2);
    expect(table.schema.columns[0]).to.eql({
      name: "keyy",
      type: "text",
    });
    expect(table.schema.columns[1]).to.eql({
      name: "val",
      type: "text",
    });
    expect(table.name).to.eql(tableName);
  });

  test("A write that violates table constraints throws error", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);

    const { meta: createMetadata } = await db
      .prepare(
        "CREATE TABLE test_create_tc_violation (id TEXT, name TEXT, PRIMARY KEY(id));"
      )
      .run();
    const queryableName = createMetadata.txn?.name ?? "";

    await expect(
      (async function () {
        await db
          .prepare(`INSERT INTO ${queryableName} VALUES (1, '1'), (1, '1')`)
          .all();
      })()
    ).to.be.rejectedWith(
      // TODO: old error was
      //       `db query execution failed (code: SQLITE_UNIQUE constraint failed: ${queryableName}.id, msg: UNIQUE constraint failed: ${queryableName}.id)`
      //       the new error isn't very informative
      "ALL_ERROR"
    );
  });
});
