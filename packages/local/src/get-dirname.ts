// NOTE: this file is only for tests
import { join } from "node:path";

export const getDirname = function (): string {
  return join(process.cwd(), "dist", "esm");
};
