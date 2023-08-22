import { Fetcher } from "./fetcher.js";
import { ApiResponse, ApiError, FetchConfig } from "./types.js";
import type { paths as Paths, components as Components } from "./validator.js";
import { prepReadConfig } from "../../helpers/index.js";

export { ApiResponse, Fetcher, ApiError, FetchConfig };
export type { Paths, Components };

export function getFetcher(
  config: FetchConfig
): ReturnType<typeof Fetcher.for<Paths>> {
  const fetcher = Fetcher.for<Paths>();
  fetcher.configure(prepReadConfig(config));
  return fetcher;
}
