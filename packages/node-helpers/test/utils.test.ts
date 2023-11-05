import { resolve } from "node:path";
import { strictEqual, throws, deepStrictEqual } from "node:assert";
import chai from "chai";
import { describe, test } from "mocha";
import { temporaryWrite, temporaryDirectory } from "tempy";
import { jsonFileAliases } from "../src/utils.js";

const expect = chai.expect;

describe("utils", function () {
  describe("jsonFileAliases", function () {
    describe("with sync", function () {
      test("should read and write to a valid and existing JSON file", async function () {
        const aliasesFilePath = await temporaryWrite(`{}`, {
          extension: "json",
        });
        const aliases = jsonFileAliases(aliasesFilePath);
        const data = { foo: "bar" };
        aliases.write(data);
        const nameMap = aliases.read();
        deepStrictEqual(nameMap, data);
      });

      test("should create & use file when filename does not exist but path is valid directory", async function () {
        const aliasesDirPath = temporaryDirectory();
        const aliasesFilePath = resolve(aliasesDirPath, "aliases-file.json"); // Provide the filename to create
        const aliases = jsonFileAliases(aliasesFilePath);
        const data = { foo: "bar" };
        aliases.write(data);
        const nameMap = aliases.read();
        deepStrictEqual(nameMap, data);
      });

      test("should create & use file when path is valid directory and no filename provided", async function () {
        const aliasesDirPath = temporaryDirectory();
        const aliasesFilePath = resolve(aliasesDirPath);
        const aliases = jsonFileAliases(aliasesFilePath); // Default filename to `tableland.aliases.json`
        const data = { foo: "bar" };
        aliases.write(data);
        const nameMap = aliases.read();
        deepStrictEqual(nameMap, data);
      });

      test("should fail when path is invalid", async function () {
        const aliasesFilePath = resolve("./invalid/path");
        throws(
          () => jsonFileAliases(aliasesFilePath),
          (err: any) => {
            strictEqual(err.message, "invalid aliases path");
            return true;
          }
        );
      });

      test("should fail when path is valid but points to a non-JSON file", async function () {
        // Path to an existing .txt file
        let aliasesFilePath = await temporaryWrite(`{}`, {
          extension: "txt",
        });
        throws(
          () => jsonFileAliases(aliasesFilePath),
          (err: any) => {
            strictEqual(err.message, "invalid aliases path");
            return true;
          }
        );
        // Path to an existing directory plus non-existent filename, but the path
        // is to an invalid .txt filetype
        const aliasesDirPath = temporaryDirectory();
        aliasesFilePath = resolve(aliasesDirPath, "aliases-file.txt");
        throws(
          () => jsonFileAliases(aliasesFilePath),
          (err: any) => {
            strictEqual(err.message, "invalid aliases path");
            return true;
          }
        );
      });
    });

    describe("with async", function () {
      test("should read and write to a valid and existing JSON file", async function () {
        const aliasesFilePath = await temporaryWrite(`{}`, {
          extension: "json",
        });
        const aliases = await jsonFileAliases(aliasesFilePath, true);
        const data = { foo: "bar" };
        await aliases.write(data);
        const nameMap = await aliases.read();
        deepStrictEqual(nameMap, data);
      });

      test("should create & use file when filename does not exist but path is valid directory", async function () {
        const aliasesDirPath = temporaryDirectory();
        const aliasesFilePath = resolve(aliasesDirPath, "aliases-file.json"); // Provide the filename to create
        const aliases = await jsonFileAliases(aliasesFilePath, true);
        const data = { foo: "bar" };
        await aliases.write(data);
        const nameMap = await aliases.read();
        deepStrictEqual(nameMap, data);
      });

      test("should create & use file when path is valid directory and no filename provided", async function () {
        const aliasesDirPath = temporaryDirectory();
        const aliasesFilePath = resolve(aliasesDirPath);
        const aliases = await jsonFileAliases(aliasesFilePath, true); // Default filename to `tableland.aliases.json`
        const data = { foo: "bar" };
        await aliases.write(data);
        const nameMap = await aliases.read();
        deepStrictEqual(nameMap, data);
      });

      test("should fail when path is invalid", async function () {
        const aliasesFilePath = resolve("./invalid/path");
        await expect(
          (async function () {
            await jsonFileAliases(aliasesFilePath, true);
          })()
        ).to.be.rejectedWith("invalid aliases path");
      });

      test("should fail when path is valid but points to a non-JSON file", async function () {
        // Path to an existing .txt file
        let aliasesFilePath = await temporaryWrite(`{}`, {
          extension: "txt",
        });
        await expect(
          (async function () {
            await jsonFileAliases(aliasesFilePath, true);
          })()
        ).to.be.rejectedWith("invalid aliases path");
        // Path to an existing directory plus non-existent filename, but the path
        // is to an invalid .txt filetype
        const aliasesDirPath = temporaryDirectory();
        aliasesFilePath = resolve(aliasesDirPath, "aliases-file.txt");
        await expect(
          (async function () {
            await jsonFileAliases(aliasesFilePath, true);
          })()
        ).to.be.rejectedWith("invalid aliases path");
      });
    });
  });
});
