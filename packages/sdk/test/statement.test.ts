/* eslint-disable @typescript-eslint/no-non-null-assertion */
import assert, {
  deepStrictEqual,
  match,
  rejects,
  strictEqual,
  throws,
} from "assert";
import { describe, test } from "mocha";
import { getAccounts } from "@tableland/local";
import { getDelay } from "../src/helpers/utils.js";
import {
  createPollingController,
  getDefaultProvider,
} from "../src/helpers/index.js";
import { Database, Statement } from "../src/index.js";
import { TEST_TIMEOUT_FACTOR, TEST_PROVIDER_URL } from "./setup";

describe("statement", function () {
  this.timeout(TEST_TIMEOUT_FACTOR * 10000);
  // Note that we're using the second account here
  const [, signer, wallet2] = getAccounts(TEST_PROVIDER_URL);
  const db = new Database({ signer });

  test("when initialized via constructor", async function () {
    const sqlString = "CREATE TABLE test (counter integer);";
    const stmt = new Statement(db.config, sqlString);
    const { sql, parameters } = stmt.toObject();
    strictEqual(stmt.toString(), sqlString);
    strictEqual(parameters, undefined);
    strictEqual(sql, sqlString);
  });

  test("when created via db.prepare()", async function () {
    const sql = "CREATE TABLE test (counter integer);";
    const stmt = db.prepare(sql);
    strictEqual(stmt.toString(), sql);
    deepStrictEqual(stmt, new Statement(db.config, sql));
  });

  test("when initialized incorrectly", async function () {
    const sqlString = 12;
    throws(
      // @ts-expect-error need to tell ts to ignore this since we are testing a failure when used without ts
      () => new Statement(db.config, sqlString),
      (err: any) => {
        strictEqual(err.message, "SQL statement must be a String");
        return true;
      }
    );
  });

  describe(".run()", function () {
    let tableName: string;
    this.beforeAll(async function () {
      const { results, error, meta } = await db
        .prepare("CREATE TABLE test_run (counter integer);")
        .run();
      deepStrictEqual(results, []);
      strictEqual(error, undefined);
      assert(meta.duration != null);
      match(meta.txn!.name, /^test_run_31337_\d+$/);
      const { name } = await meta.txn!.wait();
      tableName = name ?? "";
    });

    test("when create statement has a syntax error", async function () {
      await rejects(
        db.prepare("CREATE TABLE test_run (counter blurg);").run(),
        (err: any) => {
          strictEqual(
            err.cause.message,
            `error parsing statement: syntax error at position 36 near 'blurg'
CREATE TABLE test_run (counter blurg);
                               ^^^^^`
          );
          return true;
        }
      );
    });

    describe("alter table statement", function () {
      let alterTableName: string;
      // reset the table before each test
      this.beforeEach(async function () {
        const { results, error, meta } = await db
          .prepare("CREATE TABLE test_alter (a integer, b int);")
          .run();

        deepStrictEqual(results, []);
        strictEqual(error, undefined);
        assert(meta.duration != null);
        match(meta.txn!.name, /^test_alter_31337_\d+$/);

        const { name } = await meta.txn!.wait();
        alterTableName = name ?? "";

        // insert a row to query during tests
        const { meta: insertMeta } = await db
          .prepare(`INSERT INTO ${alterTableName} VALUES (1, 1);`)
          .run();
        await insertMeta.txn?.wait();

        const { results: selectResults } = await db
          .prepare(`SELECT * FROM ${alterTableName};`)
          .all<{ a: number; b: number }>();
        strictEqual(selectResults.length, 1);
        strictEqual(selectResults[0].a, 1);
        strictEqual(selectResults[0].b, 1);
      });

      test("when alter table statement adds a column", async function () {
        const stmt = db.prepare(
          `ALTER TABLE ${alterTableName} ADD COLUMN c int;`
        );
        const { results, meta, error } = await stmt.run();
        deepStrictEqual(results, []);
        strictEqual(error, undefined);
        assert(meta.duration != null);
        assert(meta.txn?.transactionHash != null);
        strictEqual(meta.txn.name, alterTableName);

        await meta.txn?.wait();

        // insert a value with new columns
        const { meta: insertMeta } = await db
          .prepare(`INSERT INTO ${alterTableName} (a, b, c) VALUES (2, 2, 2);`)
          .run();
        await insertMeta.txn?.wait();

        const { results: selectResults } = await db
          .prepare(`SELECT * FROM ${alterTableName};`)
          .all<{ a: number; b: number; c: number }>();
        strictEqual(selectResults.length, 2);
        strictEqual(selectResults[0].a, 1);
        assert(selectResults[0].c == null);
        strictEqual(selectResults[1].a, 2);
        strictEqual(selectResults[1].b, 2);
        strictEqual(selectResults[1].c, 2);
      });

      test("when alter table statement renames a column", async function () {
        const stmt = db.prepare(
          `ALTER TABLE ${alterTableName} RENAME COLUMN a to c;`
        );
        const { results, meta, error } = await stmt.run();
        deepStrictEqual(results, []);
        strictEqual(error, undefined);
        assert(meta.duration != null);
        assert(meta.txn?.transactionHash != null);
        strictEqual(meta.txn.name, alterTableName);

        await meta.txn?.wait();

        // insert a value with new column name
        const { meta: insertMeta } = await db
          .prepare(`INSERT INTO ${alterTableName} (c) VALUES (2);`)
          .run();
        await insertMeta.txn?.wait();

        const { results: selectResults } = await db
          .prepare(`SELECT * FROM ${alterTableName};`)
          .all<{ c: number; b: number }>();
        strictEqual(selectResults.length, 2);
        // existing column is renamed
        strictEqual(selectResults[0].c, 1);
        strictEqual(selectResults[0].b, 1);
        // @ts-expect-error checking result of an http response
        assert(selectResults[0].a == null);
        // new column exists
        strictEqual(selectResults[1].c, 2);
      });

      test("when alter table statement drops a column", async function () {
        const stmt = db.prepare(`ALTER TABLE ${alterTableName} DROP COLUMN b;`);
        const { results, meta, error } = await stmt.run();
        deepStrictEqual(results, []);
        strictEqual(error, undefined);
        assert(meta.duration != null);
        assert(meta.txn?.transactionHash != null);
        strictEqual(meta.txn.name, alterTableName);

        await meta.txn?.wait();

        const { meta: insertMeta } = await db
          .prepare(`INSERT INTO ${alterTableName} (a, b) VALUES (2, 2);`)
          .run();
        await rejects(insertMeta.txn!.wait(), /has no column named b/i);

        const { results: selectResults } = await db
          .prepare(`SELECT * FROM ${alterTableName};`)
          .all<{ a: number }>();

        strictEqual(selectResults.length, 1);
        strictEqual(selectResults[0].a, 1);
        // @ts-expect-error checking result of an http response
        assert(selectResults[0].b == null);
      });

      test("when non-owner tries to alter table", async function () {
        const provider = getDefaultProvider(TEST_PROVIDER_URL);
        const signer = wallet2.connect(provider);
        const db2 = new Database({ signer });

        const [batchGrant] = await db.batch([
          db.prepare(
            `GRANT INSERT ON ${alterTableName} TO '${wallet2.address}';`
          ),
          db.prepare(
            `GRANT UPDATE ON ${alterTableName} TO '${wallet2.address}';`
          ),
          db.prepare(
            `GRANT DELETE ON ${alterTableName} TO '${wallet2.address}';`
          ),
        ]);
        // db has autoWait turned off
        await batchGrant.meta.txn?.wait();

        const { meta } = await db2
          .prepare(`ALTER TABLE ${alterTableName} DROP COLUMN b;`)
          .run();
        await rejects(meta.txn!.wait(), /non owner cannot execute alter stmt/i);
      });
    });

    test("when insert statement is valid", async function () {
      const stmt = db.prepare(`INSERT INTO ${tableName} VALUES (1);`);
      const { results, meta, error } = await stmt.run();
      deepStrictEqual(results, []);
      strictEqual(error, undefined);
      assert(meta.duration != null);
      assert(meta.txn?.transactionHash != null);
      strictEqual(meta.txn.name, tableName);

      await meta.txn?.wait();
    });

    test("when we need to lazily get the provider/signer for an insert", async function () {
      const stmt = db.prepare(`INSERT INTO ${tableName} VALUES (1);`);
      const { results, meta, error } = await stmt.run();
      deepStrictEqual(results, []);
      strictEqual(error, undefined);
      assert(meta.duration != null);
      assert(meta.txn?.transactionHash != null);
      strictEqual(meta.txn.name, tableName);

      await meta.txn?.wait();
    });

    test("when update statement is valid", async function () {
      const stmt = db.prepare(`UPDATE ${tableName} SET counter=2;`);
      const { results, meta, error } = await stmt.run();
      deepStrictEqual(results, []);
      strictEqual(error, undefined);
      assert(meta.duration != null);
      assert(meta.txn?.transactionHash != null);
      strictEqual(meta.txn.name, tableName);

      await meta.txn?.wait();
    });

    test("when trying to update a table on the wrong chain", async function () {
      await rejects(
        db.prepare("UPDATE prefix_80002_1 SET counter=2").run(),
        (err: any) => {
          strictEqual(
            err.cause.message,
            "chain id mismatch: received 80002, expected 31337"
          );
          return true;
        }
      );
    });

    test("when update statement has bound parameters", async function () {
      const stmt = db.prepare(`UPDATE ${tableName} SET counter=?;`).bind(3);
      const { results, meta, error } = await stmt.run();
      deepStrictEqual(results, []);
      strictEqual(stmt.toString(), `UPDATE ${tableName} SET counter=3;`);
      strictEqual(error, undefined);
      assert(meta.duration != null);
      assert(meta.txn?.transactionHash != null);
      strictEqual(meta.txn.name, tableName);

      await meta.txn?.wait();
    });

    describe("with options", function () {
      test("when using an abort controller to halt a query", async function () {
        const stmt = db.prepare(`SELECT * FROM ${tableName};`);
        const controller = createPollingController();
        controller.abort();
        await rejects(stmt.run({ controller }), (err: any) => {
          match(err.cause.message, /Th(e|is) operation was aborted/);
          return true;
        });
      });

      test("when using an abort controller and select statement is valid", async function () {
        const controller = createPollingController();
        const stmt = db.prepare(`SELECT * FROM ${tableName};`);
        const { results, meta, error } = await stmt.run<{ counter: number }>({
          controller,
        });
        strictEqual(error, undefined);
        assert(meta.duration != null);
        assert(results.length > 0);
      });
    });
  });

  describe(".all()", function () {
    let tableName: string;
    this.beforeAll(async function () {
      {
        const { meta } = await db
          .prepare(
            "CREATE TABLE test_all (id integer primary key, counter integer, info text);"
          )
          .run();
        tableName = meta.txn?.name ?? "";
        // For testing purposes, we abort the wait before we even start
        const controller = createPollingController();
        controller.abort();
        await meta.txn?.wait(controller).catch(() => {});
      }
      {
        const { meta } = await db
          .prepare(
            `INSERT INTO ${tableName} (counter, info)
          VALUES (1, 'one'), (2, 'two'), (3, 'three'), (4, 'four');`
          )
          .run();
        await meta.txn?.wait();
      }
    });

    test("when select statment has a syntax error", async function () {
      await rejects(db.prepare("SELECT * FROM 3.14;").all(), (err: any) => {
        strictEqual(
          err.cause.message,
          `error parsing statement: syntax error at position 18 near '3.14'
SELECT * FROM 3.14;
              ^^^^`
        );
        return true;
      });
    });

    test("when select statment has a runtime error", async function () {
      await rejects(
        db.prepare("SELECT * FROM test_all_31337_0;").all(),
        (err: any) => {
          match(err.cause.message, /.*: no such table: test_all_31337_0$/);
          return true;
        }
      );
    });

    test("when select all statement is valid", async function () {
      const stmt = db.prepare(`SELECT * FROM ${tableName};`);
      const { results, meta, error } = await stmt.all();
      strictEqual(meta.txn, undefined);
      strictEqual(error, undefined);
      assert(meta.duration != null);
      deepStrictEqual(results, [
        { id: 1, counter: 1, info: "one" },
        { id: 2, counter: 2, info: "two" },
        { id: 3, counter: 3, info: "three" },
        { id: 4, counter: 4, info: "four" },
      ]);
    });

    test("when trying to extract a missing column", async function () {
      const sql = `SELECT missing FROM ${tableName};`;

      await rejects(db.prepare(sql).all<any>(), (err: any) => {
        strictEqual(
          err.cause.message,
          `running read statement: parsing result to json: executing query: no such column: missing\n${sql}`
        );
        return true;
      });
    });

    test("when extracting a column from multiple rows", async function () {
      const stmt = db.prepare(`SELECT counter FROM ${tableName};`);
      const { results, meta, error } = await stmt.all<any>();
      strictEqual(meta.txn, undefined);
      strictEqual(error, undefined);
      assert(meta.duration != null);
      deepStrictEqual(results, [
        { counter: 1 },
        { counter: 2 },
        { counter: 3 },
        { counter: 4 },
      ]);
    });

    test("when select all statement has a bound parameter", async function () {
      await getDelay(500); // Just to keep request frequency down...
      const stmt = db.prepare(`SELECT * FROM ${tableName} WHERE counter >= ?;`);
      const { results } = await stmt.bind(3).all();
      deepStrictEqual(results, [
        { id: 3, counter: 3, info: "three" },
        { id: 4, counter: 4, info: "four" },
      ]);
    });

    test("when select all statement has only named bound parameters", async function () {
      await getDelay(500); // Just to keep request frequency down...
      const stmt = db.prepare(
        `SELECT * FROM ${tableName} WHERE counter >= :counter;`
      );
      const { results } = await stmt.bind({ counter: 3 }).all();
      deepStrictEqual(results, [
        { id: 3, counter: 3, info: "three" },
        { id: 4, counter: 4, info: "four" },
      ]);
    });

    test("when query attempts to join across chain types", async function () {
      const stmt = db.prepare(
        `SELECT * FROM ${tableName}, healthbot_1_1 WHERE ${tableName}.counter == heathbot_1_1.counter;`
      );
      await rejects(stmt.all(), (err: any) => {
        strictEqual(
          err.cause.message,
          "network mismatch: mix of testnet and mainnet chains"
        );
        return true;
      });
    });

    test("when select statement with where returns empty", async function () {
      const stmt = db.prepare(`SELECT * FROM ${tableName} WHERE false;`);
      const { results, meta, error } = await stmt.all();
      strictEqual(meta.txn, undefined);
      strictEqual(error, undefined);
      assert(meta.duration != null);
      deepStrictEqual(results, []);
    });

    test("when a runtime error throws during a secondary wait", async function () {
      const { meta } = await db
        .prepare(
          `INSERT INTO ${tableName} (id, counter, info) VALUES (1, ?1, ?2)`
        )
        .bind(5, "Bobby")
        .all();
      // TODO: Are we sure we don't want to use the cause pattern for these ones?
      await rejects(meta.txn!.wait(), (err: any) => {
        match(err.message, /.*UNIQUE constraint failed.*/);
        return true;
      });
    });

    describe("with autoWait turned on", function () {
      this.beforeAll(() => {
        db.config.autoWait = true;
      });

      test("when a mutating query is used", async function () {
        const stmt = db.prepare(
          `INSERT INTO ${tableName} (counter, info) VALUES (1, 'one');`
        );
        const { results, meta, error } = await stmt.all();
        strictEqual(error, undefined);
        assert(meta.duration != null);
        deepStrictEqual(results, []);
      });

      test("when multiline create query is used", async function () {
        const prefix = "multiline";
        const { results, meta, error } = await db
          .prepare(
            `CREATE TABLE ${prefix} (
              counter int,
              info text
            );`
          )
          .all();

        strictEqual(error, undefined);
        assert(meta.duration != null);
        deepStrictEqual(results, []);
        const tableName = meta.txn!.name;
        match(tableName, /^multiline_31337_\d+$/);

        await db
          .prepare(
            `INSERT INTO ${tableName} (counter, info) VALUES (1, 'one');`
          )
          .all();

        const res = await db.prepare(`SELECT * FROM ${tableName};`).all();

        deepStrictEqual(res.results, [{ counter: 1, info: "one" }]);
      });

      this.afterAll(() => {
        db.config.autoWait = false;
      });
    });

    describe("with options", function () {
      test("when using an abort controller to halt a query", async function () {
        const stmt = db
          .prepare(`SELECT name, age FROM ${tableName} WHERE name=?`)
          .bind("Bobby");
        const controller = createPollingController();
        controller.abort();
        await rejects(stmt.all({ controller }), (err: any) => {
          match(err.cause.message, /Th(e|is) operation was aborted/);
          return true;
        });
      });

      test("when using an abort controller and select statement is valid", async function () {
        const controller = createPollingController();
        const stmt = db.prepare(`SELECT * FROM ${tableName};`);
        const { results, meta, error } = await stmt.all<{
          counter: number;
          info: string;
        }>({
          controller,
        });
        strictEqual(error, undefined);
        assert(meta.duration != null);
        assert(results.length > 0);
      });
    });
  });

  describe(".first()", function () {
    let tableName: string;
    this.beforeAll(async function () {
      {
        const { meta } = await db
          .prepare("CREATE TABLE test_first (counter integer, info text);")
          .run();
        tableName = meta.txn?.name ?? "";
      }
      {
        const { meta } = await db
          .prepare(
            `INSERT INTO ${tableName} (counter, info)
          VALUES (1, 'one'), (2, 'two'), (3, 'three'), (4, 'four');`
          )
          .run();

        await meta.txn?.wait();
      }
    });

    test("when select statement has a error parsing statement", async function () {
      await rejects(db.prepare("SELECT * FROM 3.14;").first(), (err: any) => {
        strictEqual(
          err.cause.message,
          `error parsing statement: syntax error at position 18 near '3.14'
SELECT * FROM 3.14;
              ^^^^`
        );
        return true;
      });
    });

    test("when trying to extract a missing column", async function () {
      const sql = `SELECT * FROM ${tableName};`;
      await rejects(db.prepare(sql).first<any>("missing"), (err: any) => {
        strictEqual(err.cause.message, `no such column: missing\n${sql}`);
        return true;
      });
    });

    test("when select statment has a runtime error", async function () {
      await rejects(
        db.prepare("SELECT * FROM test_first_31337_0;").first(),
        (err: any) => {
          match(err.cause.message, /.*: no such table: test_first_31337_0$/);
          return true;
        }
      );
    });

    test("when select * statement is valid", async function () {
      const stmt = db.prepare(`SELECT * FROM ${tableName};`);
      const row = await stmt.first<{ counter: number; info: string }>();
      deepStrictEqual(row, { counter: 1, info: "one" });
    });

    test("when select all statement has a bound parameter", async function () {
      const stmt = db.prepare(`SELECT * FROM ${tableName} WHERE counter < ?;`);
      const row = await stmt.bind(3).first<{ counter: number; info: string }>();
      deepStrictEqual(row, { counter: 1, info: "one" });
    });

    test("when select statement with where returns empty", async function () {
      const stmt = db.prepare(`SELECT * FROM ${tableName} WHERE false;`);
      const row = await stmt.first();
      strictEqual(row, null);
    });

    test("when select statement with colName of undefined is valid", async function () {
      const stmt = db.prepare(`SELECT * FROM ${tableName};`);
      const row = await stmt.first<{ counter: number; info: string }>(
        undefined
      );
      deepStrictEqual(row, { counter: 1, info: "one" });
    });

    test("when select statement with colName of string is valid", async function () {
      const stmt = db.prepare(`SELECT * FROM ${tableName};`);
      const row = await stmt.first<{ counter: number }>("counter");
      deepStrictEqual(row, [1]);
    });

    describe("with autoWait turned on", function () {
      this.beforeAll(() => {
        db.config.autoWait = true;
      });
      test("when a mutating query is used", async function () {
        const stmt = db.prepare(`INSERT INTO ${tableName} VALUES (1, 'one');`);
        const row = await stmt.first();
        strictEqual(row, null);
      });
      this.afterAll(() => {
        db.config.autoWait = false;
      });
    });

    describe("with options", function () {
      test("when using an abort controller to halt a query with no colName param passed", async function () {
        const stmt = db.prepare(`SELECT * FROM ${tableName};`);
        const controller = createPollingController();
        controller.abort();
        await rejects(
          stmt.first<{ counter: number; info: string }>({ controller }),
          (err: any) => {
            match(err.cause.message, /Th(e|is) operation was aborted/);
            return true;
          }
        );
      });

      test("when using an abort controller to halt a query with colName as undefined", async function () {
        const stmt = db.prepare(`SELECT * FROM ${tableName};`);
        const controller = createPollingController();
        controller.abort();
        await rejects(stmt.first(undefined, { controller }), (err: any) => {
          match(err.cause.message, /Th(e|is) operation was aborted/);
          return true;
        });
      });

      test("when using an abort controller to halt a query with colName as string", async function () {
        const stmt = db.prepare(`SELECT * FROM ${tableName};`);
        const controller = createPollingController();
        controller.abort();
        await rejects(
          stmt.first<{ counter: number }>("counter", { controller }),
          (err: any) => {
            match(err.cause.message, /Th(e|is) operation was aborted/);
            return true;
          }
        );
      });

      test("when using an abort controller and select with no colName param passed is valid", async function () {
        const controller = createPollingController();
        const stmt = db.prepare(`SELECT * FROM ${tableName};`);
        const row = await stmt.first<{ counter: number; info: string }>({
          controller,
        });
        deepStrictEqual(row, { counter: 1, info: "one" });
      });

      test("when using an abort controller and select with colName of undefined is valid", async function () {
        const controller = createPollingController();
        const stmt = db.prepare(`SELECT * FROM ${tableName};`);
        const row = await stmt.first<{ counter: number; info: string }>(
          undefined,
          {
            controller,
          }
        );
        deepStrictEqual(row, { counter: 1, info: "one" });
      });

      test("when using an abort controller and select with colName of string is valid", async function () {
        const controller = createPollingController();
        const stmt = db.prepare(`SELECT * FROM ${tableName};`);
        const row = await stmt.first<{ counter: number }>("counter", {
          controller,
        });
        deepStrictEqual(row, [1]);
      });
    });
  });

  describe(".raw()", function () {
    let tableName: string;
    this.beforeAll(async function () {
      {
        const { meta } = await db
          .prepare(
            "CREATE TABLE test_raw (id INTEGER PRIMARY KEY, counter INTEGER, info TEXT);"
          )
          .run();
        tableName = meta.txn?.name ?? "";
      }
      {
        const { meta } = await db
          .prepare(
            `INSERT INTO ${tableName} (counter, info)
          VALUES (1, 'one'), (2, 'two'), (3, 'three'), (4, 'four');`
          )
          .run();

        await meta.txn?.wait();
      }
    });

    test("when select statment has a error parsing statement", async function () {
      await rejects(db.prepare("SELECT * FROM 3.14;").raw(), (err: any) => {
        strictEqual(
          err.cause.message,
          `error parsing statement: syntax error at position 18 near '3.14'
SELECT * FROM 3.14;
              ^^^^`
        );
        return true;
      });
    });

    test("when select statment has a runtime error", async function () {
      await rejects(
        db.prepare("SELECT * FROM test_raw_31337_0;").raw(),
        (err: any) => {
          match(err.cause.message, /.*: no such table: test_raw_31337_0$/);
          return true;
        }
      );
    });

    test("when select * statement is valid", async function () {
      const stmt = db.prepare(`SELECT * FROM ${tableName};`);
      const row = await stmt.raw<{ counter: number; info: string }>();
      deepStrictEqual(row, [
        [1, 1, "one"],
        [2, 2, "two"],
        [3, 3, "three"],
        [4, 4, "four"],
      ]);
    });

    test("when select all statement has a bound parameter", async function () {
      const stmt = db.prepare(`SELECT * FROM ${tableName} WHERE counter < ?;`);
      const row = await stmt.bind(3).raw<{ counter: number; info: string }>();
      deepStrictEqual(row, [
        [1, 1, "one"],
        [2, 2, "two"],
      ]);
    });

    test("when select statement with where returns empty", async function () {
      const stmt = db.prepare(`SELECT * FROM ${tableName} WHERE false;`);
      const row = await stmt.raw();
      deepStrictEqual(row, []);
    });

    describe("with autoWait turned on", function () {
      this.beforeAll(() => {
        db.config.autoWait = true;
      });
      test("when a mutating query is used", async function () {
        const stmt = db.prepare(
          `INSERT INTO ${tableName}(counter, info)  VALUES (1, 'one');`
        );
        const row = await stmt.raw();
        deepStrictEqual(row, []);
      });
      this.afterAll(() => {
        db.config.autoWait = false;
      });
    });

    describe("with options", function () {
      test("when using an abort controller to halt a query", async function () {
        const stmt = db.prepare(`SELECT * FROM ${tableName};`);
        const controller = createPollingController();
        controller.abort();
        await rejects(stmt.raw({ controller }), (err: any) => {
          match(err.cause.message, /Th(e|is) operation was aborted/);
          return true;
        });
      });

      test("when using an abort controller and select statement is valid", async function () {
        const controller = createPollingController();
        const stmt = db.prepare(`SELECT * FROM ${tableName};`);
        const results = await stmt.raw<{
          id: number;
          counter: number;
          info: string;
        }>({
          controller,
        });
        assert(results.length > 0);
      });
    });
  });

  describe(".bind()", function () {
    test("with basic variadic arguments", function () {
      const stmt = db
        .prepare("INSERT INTO people VALUES (?, ?, '?', ?);")
        .bind(3, "string", true);
      strictEqual(
        stmt.toString(),
        "INSERT INTO people VALUES (3, 'string', '?', 1);"
      );
    });

    test("with mixed types and nesting", function () {
      const stmt = db
        .prepare(
          "INSERT INTO people VALUES (@name, ?, :name, ?, '?', ?4, ?3, ?, $blah);"
        )
        .bind(
          45,
          { name: "Hen'ry", blah: "😬" },
          [54, true, Uint8Array.from([1, 2, 3])],
          null
        );
      strictEqual(
        stmt.toString(),
        "INSERT INTO people VALUES ('Hen''ry', 45, 'Hen''ry', 54, '?', X'010203', 1, NULL, '😬');"
      );
    });

    test("with out of order indexing via NNN-th parameters", function () {
      const stmt = db
        .prepare("INSERT INTO people VALUES (?5, ?, ?2, ?);")
        .bind(1, 2, 3, 4, 5, "six", "seven");
      strictEqual(
        stmt.toString(),
        "INSERT INTO people VALUES (5, 'six', 2, 'seven');"
      );
    });

    test("when wrong number of parameters passsed to query fails", async function () {
      throws(
        () =>
          db
            .prepare("INSERT INTO people VALUES (1, 2, 3, 4);")
            .bind(1)
            .toString(),
        (err: any) => {
          strictEqual(
            err.cause.message,
            "parameter mismatch: received (1), expected 0"
          );
          return true;
        }
      );
    });
  });
});
