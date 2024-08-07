/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { deepStrictEqual, strictEqual } from "assert";
import { describe, test } from "mocha";
import { getAccounts } from "@tableland/local";
import {
  D1Orm,
  DataTypes,
  Model,
  GenerateQuery,
  QueryType,
  type Infer,
} from "d1-orm";
import sql, { type FormatConfig } from "@databases/sql";
import { escapeSQLiteIdentifier } from "@databases/escape-identifier";
import {
  type InferInsertModel,
  type InferSelectModel,
  sql as drizzleSql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { NonceManager } from "ethers";
import { createSigner } from "../src/helpers/index.js";
import { Database } from "../src/index.js";
import { type NameMapping } from "../src/helpers/index.js";
import { TEST_TIMEOUT_FACTOR, TEST_PROVIDER_URL } from "./setup";

describe("thirdparty", function () {
  this.timeout(TEST_TIMEOUT_FACTOR * 10000);

  // Note that we're using the second account here
  const [, wallet] = getAccounts(TEST_PROVIDER_URL);
  // Test out creating a signer via `createSigner` and same settings with
  // `getAccounts` (needed for hardhat)
  const baseSigner = createSigner({
    privateKey: wallet.privateKey,
    providerUrl: TEST_PROVIDER_URL,
    options: {
      staticNetwork: true,
      batchStallTime: 0,
      cacheTimeout: -1,
    },
  });
  // Also demonstrates the nonce manager usage
  const signer = new NonceManager(baseSigner);
  // an `aliases` option is required for Drizzle ORM usage since D1 uses `exec`
  // internally to do table creation, and we need to capture the uu table name
  const nameMap: NameMapping = {};
  const db = new Database({
    signer,
    // this parameter is the core of the aliases feature
    aliases: {
      read: async function () {
        return nameMap;
      },
      write: async function (names) {
        for (const uuTableName in names) {
          nameMap[uuTableName] = names[uuTableName];
        }
      },
    },
  });

  describe("d1-orm", function () {
    const orm = new D1Orm(db);

    // We'll define our core model up here and use it in tests below
    const users = new Model(
      {
        D1Orm: orm,
        tableName: "users",
        primaryKeys: "id",
        uniqueKeys: [["email"]],
        withRowId: true, // If this is not set, `WITHOUT ROWID` will be attached and fail
      },
      {
        id: {
          type: DataTypes.INTEGER,
          notNull: true,
        },
        name: {
          type: DataTypes.STRING,
          notNull: true,
          // See https://github.com/Interactions-as-a-Service/d1-orm/issues/60
          // defaultValue: "John Doe",
        },
        email: {
          type: DataTypes.STRING,
        },
      }
    );
    type User = Infer<typeof users>;

    this.beforeAll(async function () {
      await users.CreateTable({
        strategy: "default",
      });
    });

    test("where a basic model is used to create data", async function () {
      await users.InsertOne({
        name: "Bobby Tables",
        email: "bobby-tab@gmail.com",
      });

      const [result] = await users.InsertMany([
        {
          name: "Bobby Tables",
          email: "bob-tables@gmail.com",
        },
        {
          name: "Jane Tables",
          email: "janet@gmail.com",
        },
      ]);

      await result.meta.txn.wait();

      // Use `all()` under the hood
      const { results } = await users.All({
        where: { name: "Bobby Tables" },
        limit: 1,
        offset: 0,
        orderBy: ["id"],
      });
      deepStrictEqual(results, [
        {
          name: "Bobby Tables",
          id: 1,
          email: "bobby-tab@gmail.com",
        },
      ]);

      // Use `first()` under the hood
      const first = await users.First({
        where: { name: "Bobby Tables" },
      });
      deepStrictEqual(first, {
        name: "Bobby Tables",
        id: 1,
        email: "bobby-tab@gmail.com",
      });
    });

    test("basic query building works well to then query the data", async function () {
      const { query, bindings } = GenerateQuery<User>(
        QueryType.SELECT,
        users.tableName, // Could also come from the above meta.txn objects
        {
          where: {
            name: "Bobby Tables",
          }, // this uses the type from above to enforce it to properties which exist on the table
          limit: 1, // we only want the first user
          offset: 1, // skip the first user named 'Bobby Tables' when performing this query

          // Using orderBy is a special case, so there's a few possible syntaxes for it
          orderBy: { column: "id", descending: true }, // ORDER BY id DESC NULLS LAST
        }
      );

      // Using the database directly
      const stmt = db.prepare(query).bind(bindings);
      const { results } = await stmt.all();
      deepStrictEqual(results, [
        {
          name: "Bobby Tables",
          id: 1,
          email: "bobby-tab@gmail.com",
        },
      ]);
    });

    test("where upserts are easier when using an orm", async function () {
      const user: User = {
        id: 1,
        name: "John Doe",
        email: "john-doe@gmail.com",
      };
      const { query, bindings } = GenerateQuery<User>(
        QueryType.UPSERT,
        users.tableName, // Could also come from the above meta.txn objects
        {
          data: user,
          upsertOnlyUpdateData: {
            name: user.name,
            email: user.email,
          },
          where: {
            id: user.id,
          },
        },
        "id"
      );
      // {
      //    query: "INSERT INTO users (id, name, email) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = ?, email = ? WHERE id = ?",
      //    bindings: [1, "John Doe", "john-doe@gmail.com", "John Doe", "john-doe@gmail.com", 1]
      // }

      // Using the database directly
      const stmt = db.prepare(query).bind(bindings);
      const { meta } = await stmt.run();
      const receipt = await (meta.txn as any).wait();
      strictEqual(receipt?.error, undefined);

      const results = await db
        .prepare(`SELECT * FROM ${users.tableName} WHERE id=?`)
        .bind(user.id)
        .first<User>();
      deepStrictEqual(results, user);
    });
  });

  describe("@databases/sql", function () {
    // See https://www.atdatabases.org/docs/sqlite
    const sqliteFormat: FormatConfig = {
      escapeIdentifier: (str) => escapeSQLiteIdentifier(str),
      formatValue: (value) => ({ placeholder: "?", value }),
    };
    let tableName: string;

    this.beforeAll(async function () {
      this.timeout(TEST_TIMEOUT_FACTOR * 10000);

      // First, we'll test out using sql identifiers
      const primaryKey = sql.ident("id");
      const query = sql`CREATE TABLE test_sql (${primaryKey} integer primary key, counter integer, info text);`;
      const { text, values } = query.format(sqliteFormat);
      const { meta } = await db.prepare(text).bind(values).run();
      const { name } = await meta.txn!.wait();
      tableName = name!;
    });

    test("inserting rows with interpolated values is possible", async function () {
      const one = 1;
      const four = 4;
      const three = sql.value("three");
      // Here's a safer way to inject table names
      const query = sql`INSERT INTO ${sql.ident(
        tableName
      )} (counter, ${sql.ident("info")})
          VALUES (${one}, 'one'), (2, 'two'), (3, ${three}), (${four}, 'four');`;
      const { text, values } = query.format(sqliteFormat);
      const { meta } = await db.prepare(text).bind(values).run();
      await meta.txn?.wait();
      strictEqual(typeof meta.txn?.transactionHash, "string");
      strictEqual(meta.txn?.transactionHash.length, 66);
      strictEqual(meta.duration > 0, true);
    });

    test("querying is quite easy when using @database/sql", async function () {
      const boundValue = 3;
      const query = sql`SELECT * FROM ${sql.ident(
        tableName
      )} WHERE counter >= ${boundValue};`;
      const { text, values } = query.format(sqliteFormat);
      const { results } = await db.prepare(text).bind(values).all();
      deepStrictEqual(results, [
        { id: 3, counter: 3, info: "three" },
        { id: 4, counter: 4, info: "four" },
      ]);
    });
  });

  describe("drizzle-orm", function () {
    // See https://orm.drizzle.team/docs/quick-sqlite/d1
    const user = sqliteTable("user", {
      id: integer("id").primaryKey(),
      name: text("name").notNull(),
      email: text("email").notNull().unique(),
    });
    type User = InferSelectModel<typeof user>;
    type NewUser = InferInsertModel<typeof user>;

    const database = drizzle(db, { schema: { user } });

    this.beforeAll(async function () {
      // Opt for SDK table create over Drizzle migration process for simplicity
      const { meta } = await db
        .prepare(
          "CREATE TABLE user (id integer primary key, name text not null, email text not null unique);"
        )
        .run();
      await meta.txn?.wait();
    });

    test("where a basic insert and read statements work", async function () {
      const values: NewUser = {
        id: 1,
        name: "John Doe",
        email: "john-doe@gmail.com",
      };
      const { meta } = await database.insert(user).values(values).run();
      await meta.txn?.wait();
      strictEqual(typeof meta.txn?.transactionHash, "string");
      strictEqual(meta.txn?.transactionHash.length, 66);
      strictEqual(meta.duration > 0, true);

      const results: User[] = await database.select().from(user);
      deepStrictEqual(results, [values]);
    });

    test("where a templating & run() works for update and read", async function () {
      const writeSql = drizzleSql`update user set id = 2, name = 'Jane Doe', email = 'jane-doe@gmail.com' where id = 1`;
      const { meta } = await database.run(writeSql);
      await meta.txn?.wait();
      strictEqual(typeof meta.txn?.transactionHash, "string");
      strictEqual(meta.txn?.transactionHash.length, 66);
      strictEqual(meta.duration > 0, true);

      const readSql = drizzleSql`select * from user where id = 2`;
      const { results } = await database.run(readSql);
      deepStrictEqual(results, [
        { id: 2, name: "Jane Doe", email: "jane-doe@gmail.com" },
      ]);
    });
  });
});
