import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { strictEqual } from "node:assert";
import { describe, test } from "mocha";
import { getAccounts } from "@tableland/local";
import { Database } from "@tableland/sdk";
import { providers } from "ethers";
import { jsonFileAliases } from "../src/utils.js";
import { TEST_TIMEOUT_FACTOR, TEST_PROVIDER_URL } from "./setup.js";

const { getDefaultProvider } = providers;
const _dirname = url.fileURLToPath(new URL(".", import.meta.url));

describe("sdk", function () {
  this.timeout(TEST_TIMEOUT_FACTOR * 10000);
  // Note that we're using the second account here
  const [, wallet] = getAccounts();
  const provider = getDefaultProvider(TEST_PROVIDER_URL);
  const signer = wallet.connect(provider);

  describe("json file aliases", function () {
    const aliasesDir = path.join(_dirname, "aliases");
    const aliasesFile = path.join(aliasesDir, "json-file-aliases.json");
    try {
      fs.mkdirSync(aliasesDir);
    } catch (err) {}

    const db = new Database({
      signer,
      // use the built-in SDK helper to setup and manage json aliases files
      aliases: jsonFileAliases(aliasesFile),
    });

    beforeEach(function () {
      // reset the aliases file, and ensure the helper
      // creates the file if it doesn't exist
      try {
        fs.unlinkSync(aliasesFile);
      } catch (err) {}
    });

    this.afterAll(function () {
      try {
        fs.unlinkSync(aliasesFile);
      } catch (err) {}
    });

    test("running create statement adds name to aliases", async function () {
      const tablePrefix = "json_aliases_table";
      const { meta } = await db
        .prepare(`CREATE TABLE ${tablePrefix} (counter int, info text);`)
        .all();

      const uuTableName = meta.txn?.name ?? "";
      const nameMap = (await db.config.aliases?.read()) ?? {};

      strictEqual(nameMap[tablePrefix], uuTableName);
    });

    test("running create statement updates existing aliases", async function () {
      const tablePrefix1 = "json_aliases_table1";
      const tablePrefix2 = "json_aliases_table2";
      const { meta: meta1 } = await db
        .prepare(`CREATE TABLE ${tablePrefix1} (counter int, info text);`)
        .all();

      const uuTableName1 = meta1.txn?.name ?? "";
      const nameMap1 = (await db.config.aliases?.read()) ?? {};

      strictEqual(nameMap1[tablePrefix1], uuTableName1);
      strictEqual(nameMap1[tablePrefix2], undefined);

      const { meta: meta2 } = await db
        .prepare(`CREATE TABLE ${tablePrefix2} (counter int, info text);`)
        .all();

      const uuTableName2 = meta2.txn?.name ?? "";
      const nameMap2 = (await db.config.aliases?.read()) ?? {};

      strictEqual(nameMap2[tablePrefix1], uuTableName1);
      strictEqual(nameMap2[tablePrefix2], uuTableName2);
    });
  });
});
