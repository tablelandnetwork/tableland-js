import {
  readFileSync,
  statSync,
  writeFileSync,
  accessSync,
  constants,
} from "node:fs";
import { stat, readFile, writeFile, access } from "node:fs/promises";
import { extname, resolve, dirname } from "node:path";

/**
 * A series of mappings from a table alias to its globally unique table name.
 */
export type NameMapping = Record<string, string>;

/**
 * Used to read and write table aliases within a `Database` instance in a
 * synchronous manner.
 * @property read A function that returns a `Promise` of a {@link NameMapping}
 * object, or a {@link NameMapping} object.
 * @property write A function that accepts a {@link NameMapping} object and
 * returns `void`.
 */
export interface AliasesNameMapSync {
  read: () => NameMapping;
  write: (map: NameMapping) => void;
}

/**
 * Used to read and write table aliases within a `Database` instance in an
 * asynchronous manner.
 * @property read A function that returns a `Promise` of a {@link NameMapping}
 * object, or a {@link NameMapping} object.
 * @property write A function that accepts a {@link NameMapping} object and
 * returns a `Promise` of `void`.
 */
export interface AliasesNameMapAsync {
  read: () => Promise<NameMapping>;
  write: (map: NameMapping) => Promise<void>;
}

/**
 * Used to read and write table aliases within a `Database` instance. See
 * {@link AliasesNameMapAsync} and {@link AliasesNameMapSync} for more details.
 */
export type AliasesNameMap = AliasesNameMapSync | AliasesNameMapAsync;

/**
 * Validate that a path exists and is readable, synchronously.
 * @param path Path to a file or directory.
 * @returns `true` if the path exists and is readable, `false` otherwise.
 */
function canReadPathSync(path: string): boolean {
  try {
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a path exists and is readable, asynchronously.
 * @param path Path to a file or directory.
 * @returns `true` if the path exists and is readable, `false` otherwise.
 */
async function canReadPathAsync(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a path exists and is writable, synchronously.
 * @param path Path to a file or directory.
 * @returns `true` if the path exists and is writable, `false` otherwise.
 */
function canWritePathSync(path: string): boolean {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a path exists and is writable, asynchronously.
 * @param path Path to a file or directory.
 * @returns `true` if the path exists and is writable, `false` otherwise.
 */
async function canWritePathAsync(path: string): Promise<boolean> {
  try {
    await access(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a path exists and is both readable & writable, synchronously.
 * @param path Path to a file or directory.
 * @returns `true` if the path exists and is both readable & writable, `false`
 * otherwise.
 */
const pathExistsSync = (path: string): boolean =>
  canReadPathSync(path) && canWritePathSync(path);

/**
 * Validate that a path exists and is both readable & writable, asynchronously.
 * @param path Path to a file or directory.
 * @returns `true` if the path exists and is both readable & writable, `false`
 * otherwise.
 */
const pathExistsAsync = async (path: string): Promise<boolean> =>
  (await canReadPathAsync(path)) && (await canWritePathAsync(path));

/**
 * Get the path to where an aliases file exists or should be created,
 * synchronously.
 * @param path Path to an existing aliases file, a directory where one
 * should be created (with a default `tableland.aliases.json` name), or a
 * directory + the desired filename that should be created.
 * @returns The full path of the aliases file.
 */
function getFilePathSync(path: string): string {
  const pathExists = pathExistsSync(path);
  if (pathExists) {
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
    const dirPathExists = pathExistsSync(dir);
    if (dirPathExists && extname(path) === ".json") return resolve(path);
  }
  // If none of the above, the path does not exist, or the path is pointing to
  // an invalid filetype (not JSON).
  throw new Error(`invalid aliases path`);
}

/**
 * Get the path to where an aliases file exists or should be created,
 * asynchronously.
 * @param path Path to an existing aliases file, a directory where one
 * should be created (with a default `tableland.aliases.json` name), or a
 * directory + the desired filename that should be created.
 * @returns The full path of the aliases file.
 */
async function getFilePathAsync(path: string): Promise<string> {
  const pathExists = await pathExistsAsync(path);
  if (pathExists) {
    const stats = await stat(path);
    // Check if the full path is an existing JSON file.
    if (stats.isFile() && extname(path) === ".json") return resolve(path);
    // Check if the full path is just a directory, meaning, the filename should
    // be created as the default `tableland.aliases.json`.
    if (stats.isDirectory()) return resolve(path, "tableland.aliases.json");
  } else {
    // If the full path does not exist, check if the directory exists, meaning,
    // the filename is non-existent and can be created at the full path.
    const dir = dirname(path);
    const dirPathExists = await pathExistsAsync(dir);
    if (dirPathExists && extname(path) === ".json") return resolve(path);
  }
  // If none of the above, the path does not exist, or the path is pointing to
  // an invalid filetype (not JSON).
  throw new Error(`invalid aliases path`);
}

/**
 * Either find an existing table aliases file or create one, synchronously.
 * @param path Path to an existing aliases file, or the directory where one
 * should be created (can be a directory path, or directory + filename path).
 * @returns A buffer containing the JSON file contents.
 */
const findOrCreateAliasesFileSync = function (path: string): Buffer {
  if (!pathExistsSync(path)) {
    writeFileSync(path, JSON.stringify({}, null, 2));
  }
  return readFileSync(path);
};

/**
 * Either find an existing table aliases file or create one, asynchronously.
 * @param path Path to an existing aliases file, or the directory where one
 * should be created (can be a directory path, or directory + filename path).
 * @returns A buffer containing the JSON file contents.
 */
const findOrCreateAliasesFileAsync = async function (
  path: string
): Promise<Buffer> {
  if (!(await pathExistsAsync(path))) {
    await writeFile(path, JSON.stringify({}, null, 2));
  }
  return await readFile(path);
};

/**
 * Either find an existing table aliases file or create one, with an option for
 * synchronous (default) or asynchronous behavior.
 * @param path Path to an existing aliases file, or the directory where one
 * should be created (can be a directory path, or directory + filename path).
 * @param async Whether to use asynchronous or synchronous file operations.
 * Defaults to `false` for synchronous behavior.
 * @returns A buffer containing the JSON file contents.
 */
export function findOrCreateAliasesFile(
  path: string,
  async: boolean = false
): Buffer | Promise<Buffer> {
  if (!async) {
    return findOrCreateAliasesFileSync(path);
  } else {
    return findOrCreateAliasesFileAsync(path);
  }
}

/**
 * Synchronously use or create a JSON aliases file for reading and writing table
 * aliases. This exposes a `read` or `write` method that can be used by the
 * `@tableland/sdk`and its `Database` class.
 * @param path The path to an existing aliases file, a directory + filename
 * path where one should be created, or a directory path where a default
 * `tableland.aliases.json` filename should be created.
 * @returns An {@link AliasesNameMap} for table alias functionality.
 */
function jsonFileAliasesSync(path: string): AliasesNameMapSync {
  // Ensure the path exits & retrieve it: either a file, a directory, or a
  // directory that defines a non-existent filename (to be created).
  const filepath = getFilePathSync(path);
  function readSync(): NameMapping {
    const jsonBuf = findOrCreateAliasesFileSync(filepath);
    return JSON.parse(jsonBuf.toString());
  }
  return {
    read: readSync,
    write: function (nameMap: NameMapping): void {
      const current = readSync();
      writeFileSync(
        filepath,
        JSON.stringify({ ...current, ...nameMap }, null, 2)
      );
    },
  };
}

/**
 * Asynchronously use or create a JSON aliases file for reading and writing
 * table aliases. This exposes a `read` or `write` method that can be used by
 * the `@tableland/sdk` and its `Database` class.
 * @param path The path to an existing aliases file, a directory + filename
 * path where one should be created, or a directory path where a default
 * `tableland.aliases.json` filename should be created.
 * @returns An {@link AliasesNameMap} for table alias functionality.
 */
async function jsonFileAliasesAsync(
  path: string
): Promise<AliasesNameMapAsync> {
  // Ensure the path exits & retrieve it: either a file, a directory, or a
  // directory that defines a non-existent filename (to be created).
  const filepath = await getFilePathAsync(path);
  const readAsync = async (): Promise<NameMapping> => {
    const jsonBuf = await findOrCreateAliasesFileAsync(filepath);
    return JSON.parse(jsonBuf.toString());
  };
  return {
    read: readAsync,
    write: async function (nameMap: NameMapping): Promise<void> {
      const current = await readAsync();
      await writeFile(
        filepath,
        JSON.stringify({ ...current, ...nameMap }, null, 2)
      );
    },
  };
}

/**
 * Synchronously (or asynchronously) use/create a JSON aliases file for reading
 * and writing table aliases. This exposes a `read` or `write` method that can
 * be used by the `@tableland/sdk`and its `Database` class. Defaults to
 * synchronous behavior.
 * @param path The path to an existing aliases file, a directory + filename
 * path where one should be created, or a directory path where a default
 * `tableland.aliases.json` filename should be created.
 * @param async Whether to use asynchronous or synchronous file operations.
 * Defaults to `false` for synchronous behavior.
 * @returns An {@link AliasesNameMap} for table alias functionality.
 */
export function jsonFileAliases(path: string): AliasesNameMapSync;
export function jsonFileAliases(
  path: string,
  async?: false
): AliasesNameMapSync;
export function jsonFileAliases(
  path: string,
  async?: true
): Promise<AliasesNameMapAsync>;
export function jsonFileAliases(
  path: string,
  async: boolean = false
): AliasesNameMapSync | Promise<AliasesNameMapAsync> {
  if (!async) {
    return jsonFileAliasesSync(path);
  } else {
    return jsonFileAliasesAsync(path);
  }
}
