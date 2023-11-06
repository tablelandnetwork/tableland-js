import { readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { extname, resolve, dirname } from "node:path";
import type { helpers } from "@tableland/sdk";

type NameMapping = helpers.NameMapping;
interface AliasesNameMap {
  read: () => NameMapping;
  write: (map: NameMapping) => void;
}

/**
 * Get the path to where an aliases file exists or should be created.
 * @param path Path to an existing aliases file, a directory where one
 * should be created (with a default `tableland.aliases.json` name), or a
 * directory + the desired filename that should be created.
 * @returns The full path of the aliases file.
 */
function getFilePath(path: string): string {
  if (existsSync(path)) {
    const stats = statSync(path);
    // Check if the full path is an existing JSON file.
    if (stats.isFile() && extname(path) === ".json") return resolve(path);
    // Check if the full path is just a directory, meaning, the filename should
    // be created as the default `tableland.aliases.json`.
    if (stats.isDirectory()) return resolve(path, "tableland.aliases.json");
  } else {
    // If the full path does not exist, check if the directory exists, meaning,
    // the filename is non-existent and can be created at the full path.
    const dir = dirname(path);
    if (existsSync(dir) && extname(path) === ".json") return resolve(path);
  }
  // If none of the above, the path does not exist, or the path is pointing to
  // an invalid filetype (not JSON).
  throw new Error(`invalid aliases path`);
}

/**
 * Either find an existing table aliases file or create one.
 * @param path Path to an existing aliases file, or the directory where one
 * should be created (can be a directory path, or directory + filename path).
 * @returns A buffer containing the JSON file contents.
 */
export const findOrCreateAliasesFile = function (path: string): Buffer {
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify({}, null, 2));
  }

  return readFileSync(path);
};

/**
 * Use or create a JSON aliases file for reading and writing table aliases. This
 * exposes a `read` or `write` method that can be used by the `@tableland/sdk`
 * and its `Database` class.
 * @param path The path to an existing aliases file, a directory + filename
 * path where one should be created, or a directory path where a default
 * `tableland.aliases.json` filename should be created.
 * @returns An {@link AliasesNameMap} for table alias functionality.
 */
export function jsonFileAliases(path: string): AliasesNameMap {
  // Ensure the path exits & retrieve it: either a file, a directory, or a
  // directory that defines a non-existent filename (to be created).
  const filepath = getFilePath(path);
  return {
    read: function (): NameMapping {
      const jsonBuf = findOrCreateAliasesFile(filepath);
      return JSON.parse(jsonBuf.toString());
    },
    write: function (nameMap: NameMapping) {
      const current = this.read();
      writeFileSync(
        filepath,
        JSON.stringify({ ...current, ...nameMap }, null, 2)
      );
    },
  };
}
