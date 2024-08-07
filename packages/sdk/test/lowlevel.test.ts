/* eslint-disable @typescript-eslint/no-non-null-assertion */
import assert, { deepStrictEqual, match, rejects, strictEqual } from "assert";
import { describe, test } from "mocha";
import { getAccounts } from "@tableland/local";
import {
  overrideDefaults,
  getChainId,
  getBaseUrl,
  getContractAddress,
} from "../src/helpers/index.js";
import {
  exec,
  queryAll,
  queryFirst,
  queryRaw,
  extractColumn,
} from "../src/lowlevel.js";
import { extractReadonly } from "../src/registry/utils.js";
import { getDelay } from "../src/helpers/utils.js";
import { createPollingController } from "../src/helpers/await.js";
import { TEST_TIMEOUT_FACTOR, TEST_PROVIDER_URL } from "./setup";

// Just to test out these functions
const chainId = getChainId("local-tableland");
const contractAddress = getContractAddress(chainId);
overrideDefaults(chainId, { contractAddress });
// Do it again, with a string this time
overrideDefaults("local-tableland", { contractAddress });

describe("lowlevel", function () {
  this.timeout(TEST_TIMEOUT_FACTOR * 10000);
  // Note that we're using the second account here
  const [, signer] = getAccounts(TEST_PROVIDER_URL);
  const baseUrl = getBaseUrl("localhost");
  console.log();
  console.log();
  console.log();
  console.log("baseUrl is:", baseUrl);
  console.log();
  console.log();
  console.log();
  describe("exec()", function () {
    let tableName: string;
    this.beforeAll(async function () {
      const txn = await exec(
        { signer },
        {
          type: "create",
          sql: "CREATE TABLE test_exec (id integer primary key, counter integer, info text)",
          tables: ["test_exec"],
        }
      );
      await txn.wait(createPollingController(TEST_TIMEOUT_FACTOR * 30000));
      strictEqual(txn.error, undefined);
      match(txn.name, /^test_exec_31337_\d+$/);
      const { name } = await txn.wait();
      tableName = name ?? "";
    });

    test("when create statement has a syntax error", async function () {
      // This rejects on the validator because we don't have the parser to catch the syntax error
      await rejects(
        exec(
          { signer },
          {
            type: "create",
            sql: "CREATE TABLE test_exec (counter blurg)",
            tables: ["test_exec"],
          }
        ).then(async (txn) => await txn.wait()),
        (err: any) => {
          strictEqual(
            err.message,
            "query validation: unable to parse the query: syntax error at position 43 near 'blurg'"
          );
          return true;
        }
      );
    });

    test("when insert statement is valid", async function () {
      const txn = await exec(
        { signer },
        {
          type: "write",
          sql: `INSERT INTO ${tableName} (counter, info) VALUES (1, 'Tables');`,
          tables: [tableName],
        }
      );
      strictEqual(txn.error, undefined);
      assert(txn.transactionHash != null);
      strictEqual(txn.name, tableName);

      await txn.wait();
    });

    test("when update statement is valid", async function () {
      const txn = await exec(
        { signer },
        {
          type: "write",
          sql: `UPDATE ${tableName} SET counter=2`,
          tables: [tableName],
        }
      );
      strictEqual(txn.error, undefined);
      assert(txn.transactionHash != null);
      strictEqual(txn.name, tableName);

      await txn.wait();
    });

    test("when trying to update a table on the wrong chain", async function () {
      await rejects(
        exec(
          { signer },
          {
            type: "write",
            sql: `UPDATE prefix_80002_1 SET counter=2`,
            tables: ["prefix_80002_1"],
          }
        ),
        (err: any) => {
          strictEqual(
            err.message,
            "chain id mismatch: received 80002, expected 31337"
          );
          return true;
        }
      );
    });

    test("when a runtime error throws during a secondary wait", async function () {
      const txn = await exec(
        { signer },
        {
          type: "write",
          sql: `INSERT INTO ${tableName} (id, counter, info) VALUES (1, 5, 'Bobby')`,
          tables: [tableName],
        }
      );
      await rejects(txn.wait(), (err: any) => {
        match(err.message, /.*UNIQUE constraint failed.*/);
        return true;
      });
    });
  });

  describe("queryAll()", function () {
    let tableName: string;
    this.beforeAll(async function () {
      {
        const txn = await exec(
          { signer },
          {
            type: "create",
            sql: "CREATE TABLE test_all (id integer primary key, counter integer, info text)",
            tables: ["test_all"],
          }
        );
        tableName = txn.name ?? "";
        // For testing purposes, we abort the wait before we even start
        // This is ok, because we'll await the next transaction
        const controller = createPollingController();
        controller.abort();
        await txn.wait(controller).catch(() => {});
      }
      {
        const txn = await exec(
          { signer },
          {
            type: "write",
            sql: `INSERT INTO ${tableName} (counter, info)
          VALUES (1, 'one'), (2, 'two'), (3, 'three'), (4, 'four');`,
            tables: [tableName],
          }
        );
        await txn.wait();
      }
    });

    test("when select statement has a syntax error", async function () {
      // This rejects on the validator because we don't have the parser to catch the syntax error
      await rejects(
        queryAll({ baseUrl }, "SELECT * FROM 3.14;"),
        (err: any) => {
          strictEqual(
            err.message,
            "validating read query: unable to parse the query: syntax error at position 18 near '3.14'"
          );
          return true;
        }
      );
    });

    test("when select statement has a runtime error", async function () {
      await rejects(
        queryAll({ baseUrl }, "SELECT * FROM test_all_31337_0;"),
        (err: any) => {
          match(err.message, /.*: no such table: test_all_31337_0$/);
          return true;
        }
      );
    });

    test("when select all statement is valid", async function () {
      const results = await queryAll(
        { baseUrl },
        `SELECT * FROM ${tableName};`
      );
      deepStrictEqual(results, [
        { id: 1, counter: 1, info: "one" },
        { id: 2, counter: 2, info: "two" },
        { id: 3, counter: 3, info: "three" },
        { id: 4, counter: 4, info: "four" },
      ]);
    });

    test("when using an abort controller to halt a query", async function () {
      const controller = createPollingController();
      controller.abort();
      await rejects(
        queryAll(
          { baseUrl },
          `SELECT name, age FROM ${tableName} WHERE name='Bobby'`,
          controller
        ),
        (err: any) => {
          match(err.message, /Th(e|is) operation was aborted/);
          return true;
        }
      );
    });

    test("when trying to extract a missing column", async function () {
      // In the following, if we aren't using generics, typescript would catch that missing isn't valid
      // We use "any" as the type just to test passing invalid colum names
      await rejects(
        async () =>
          extractColumn(
            await queryAll<any>({ baseUrl }, `SELECT * FROM ${tableName}`),
            "missing"
          ),
        (err: any) => {
          strictEqual(err.message, "no such column: missing");
          return true;
        }
      );
    });

    test("when extracting a column from multiple rows", async function () {
      const results = extractColumn(
        await queryAll<{ counter: number }>(
          { baseUrl },
          `SELECT * FROM ${tableName}`
        ),
        "counter"
      );
      deepStrictEqual(results, [1, 2, 3, 4]);
    });

    test("when query attempts to join across chain types", async function () {
      await rejects(
        extractReadonly(
          { signer },
          { tables: [tableName, "healthbot_1_1"], type: "read" }
        ),
        (err: any) => {
          strictEqual(
            err.message,
            "network mismatch: mix of testnet and mainnet chains"
          );
          return true;
        }
      );
    });

    test("when select statement with where returns empty", async function () {
      const results = await queryAll(
        { baseUrl },
        `SELECT * FROM ${tableName} WHERE false;`
      );
      deepStrictEqual(results, []);
    });
  });

  describe("queryFirst()", function () {
    let tableName: string;
    this.beforeAll(async function () {
      {
        const txn = await exec(
          { signer },
          {
            type: "create",
            sql: "CREATE TABLE test_first (counter integer, info text)",
            tables: ["test_all"],
          }
        );
        tableName = txn.name ?? "";
      }
      {
        const txn = await exec(
          { signer },
          {
            type: "write",
            sql: `INSERT INTO ${tableName} (counter, info)
          VALUES (1, 'one'), (2, 'two'), (3, 'three'), (4, 'four');`,
            tables: [tableName],
          }
        );
        await txn.wait();
      }
    });

    test("when select statement has a error parsing statement", async function () {
      // This rejects on the validator because we don't have the parser to catch the syntax error
      await rejects(
        queryFirst({ baseUrl }, "SELECT * FROM 3.14;"),
        (err: any) => {
          strictEqual(
            err.message,
            "validating read query: unable to parse the query: syntax error at position 18 near '3.14'"
          );
          return true;
        }
      );
    });

    test("when trying to extract a missing column", async function () {
      await rejects(
        async () =>
          extractColumn(
            await queryFirst<any>({ baseUrl }, `SELECT * FROM ${tableName};`),
            "missing"
          ),
        (err: any) => {
          strictEqual(err.message, "no such column: missing");
          return true;
        }
      );
    });

    test("when select statement has a runtime error", async function () {
      await rejects(
        queryFirst({ baseUrl }, "SELECT * FROM test_first_31337_0;"),
        (err: any) => {
          match(err.message, /.*: no such table: test_first_31337_0$/);
          return true;
        }
      );
    });

    test("when select all statement is valid", async function () {
      const results = await queryFirst<{ counter: number; info: string }>(
        { baseUrl },
        `SELECT * FROM ${tableName};`
      );
      deepStrictEqual(results, { counter: 1, info: "one" });
    });

    test("when select statement with where returns empty", async function () {
      const row = await queryFirst(
        { baseUrl },
        `SELECT * FROM ${tableName} WHERE false;`
      );
      strictEqual(row, null);
    });

    test("when a mutating query is used", async function () {
      // This rejects on the validator because we don't have the parser to catch the syntax error
      await rejects(
        queryFirst({ baseUrl }, `INSERT INTO ${tableName} VALUES (1, 'one');`),
        (err: any) => {
          strictEqual(
            err.message,
            "validating read query: the query isn't a read-query"
          );
          return true;
        }
      );
    });
  });

  describe("queryRaw()", function () {
    let tableName: string;
    this.beforeAll(async function () {
      await getDelay(500);
      this.timeout(TEST_TIMEOUT_FACTOR * 15000);
      {
        const txn = await exec(
          { signer },
          {
            type: "create",
            sql: "CREATE TABLE test_raw (id INTEGER PRIMARY KEY, counter INTEGER, info TEXT);",
            tables: ["test_raw"],
          }
        );
        tableName = txn.name ?? "";
      }
      {
        const txn = await exec(
          { signer },
          {
            type: "write",
            sql: `INSERT INTO ${tableName} (counter, info)
          VALUES (1, 'one'), (2, 'two'), (3, 'three'), (4, 'four');`,
            tables: [tableName],
          }
        );
        await txn.wait();
      }
    });

    test("when select statement has a error parsing statement", async function () {
      await rejects(
        queryRaw({ baseUrl }, "SELECT * FROM 3.14;"),
        (err: any) => {
          strictEqual(
            err.message,
            "validating read query: unable to parse the query: syntax error at position 18 near '3.14'"
          );
          return true;
        }
      );
    });

    test("when select statement has a runtime error", async function () {
      await rejects(
        queryRaw({ baseUrl }, "SELECT * FROM test_raw_31337_0;"),
        (err: any) => {
          match(err.message, /.*: no such table: test_raw_31337_0$/);
          return true;
        }
      );
    });

    test("when select all statement is valid", async function () {
      const results = await queryRaw<{ counter: number; info: string }>(
        { baseUrl },
        `SELECT * FROM ${tableName}`
      );
      deepStrictEqual(results, [
        [1, 1, "one"],
        [2, 2, "two"],
        [3, 3, "three"],
        [4, 4, "four"],
      ]);
    });

    test("when select all statement has a bound parameter", async function () {
      const results = await queryRaw<{ counter: number; info: string }>(
        { baseUrl },
        `SELECT * FROM ${tableName} WHERE counter < 3;`
      );
      deepStrictEqual(results, [
        [1, 1, "one"],
        [2, 2, "two"],
      ]);
    });

    test("when select statement with where returns empty", async function () {
      const results = await queryRaw(
        { baseUrl },
        `SELECT * FROM ${tableName} WHERE false;`
      );
      deepStrictEqual(results, []);
    });

    test("when a mutating query is used", async function () {
      await rejects(
        queryRaw(
          { baseUrl },
          `INSERT INTO ${tableName}(counter, info)  VALUES (1, 'one');`
        ),
        (err: any) => {
          strictEqual(
            err.message,
            "validating read query: the query isn't a read-query"
          );
          return true;
        }
      );
    });
  });
});
