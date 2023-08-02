// NOTE: this file is only included in the build if compiling to esm
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const getDirname = function (): string {
  return dirname(fileURLToPath(import.meta.url));
};
