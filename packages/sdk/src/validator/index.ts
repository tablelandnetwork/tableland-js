import {
  type Signal,
  type PollingController,
  type ReadConfig,
  type ChainName,
  getBaseUrl,
} from "../helpers/index.js";
import { getHealth } from "./health.js";
import { getVersion, type Version } from "./version.js";
import {
  getTable,
  type Table,
  type Params as TableParams,
  type Column,
  type Schema,
} from "./tables.js";
import {
  getQuery,
  type Params as QueryParams,
  type Format,
  type TableFormat,
  type ObjectsFormat,
} from "./query.js";
import {
  getTransactionReceipt,
  pollTransactionReceipt,
  type TransactionReceipt,
  type Params as ReceiptParams,
} from "./receipt.js";

export { ApiError } from "./client/index.js";
export {
  type TransactionReceipt,
  type Table,
  type TableFormat,
  type ObjectsFormat,
  type QueryParams,
  type Column,
  type Schema,
};

/**
 * Validator provides direct access to remote Validator REST APIs.
 */
export class Validator {
  readonly config: ReadConfig;
  /**
   * Create a Validator instance with the specified connection configuration.
   * @param config The connection configuration. This must include a baseUrl
   * string. If passing the config from a pre-existing Database instance, it
   * must have a non-null baseUrl key defined.
   */
  constructor(config: Partial<ReadConfig> = {}) {
    /* c8 ignore next 3 */
    if (config.baseUrl == null) {
      throw new Error("missing baseUrl information");
    }
    this.config = config as ReadConfig;
  }

  /**
   * Create a new Validator instance that uses the default baseUrl for a given chain.
   * @param chainNameOrId The name or id of the chain to target.
   * @returns A Validator with a default baseUrl.
   */
  static forChain(chainNameOrId: ChainName | number): Validator {
    const baseUrl = getBaseUrl(chainNameOrId);
    return new Validator({ baseUrl });
  }

  /**
   * Get health status
   * @description Returns OK if the validator considers itself healthy
   */
  async health(signal?: Signal): Promise<boolean> {
    return await getHealth(this.config, signal);
  }

  /**
   * Get version information
   * @description Returns version information about the validator daemon
   */
  async version(signal?: Signal): Promise<Version> {
    return await getVersion(this.config, signal);
  }

  /**
   * Get table information
   * @description Returns information about a single table, including schema information
   */
  async getTableById(params: TableParams, signal?: Signal): Promise<Table> {
    if (
      typeof params.chainId !== "number" ||
      typeof params.tableId !== "string"
    ) {
      throw new Error("cannot get table with invalid chain or table id");
    }
    return await getTable(this.config, params);
  }

  /**
   * Query the network
   * @description Returns the results of a SQL read query against the Tabeland network
   */
  async queryByStatement<T = unknown>(
    params: QueryParams<"objects" | undefined>,
    signal?: Signal
  ): Promise<ObjectsFormat<T>>;
  async queryByStatement<T = unknown>(
    params: QueryParams<"table">,
    signal?: Signal
  ): Promise<TableFormat<T>>;
  async queryByStatement<T = unknown>(
    params: QueryParams<Format>,
    signal?: Signal
  ): Promise<TableFormat<T> | ObjectsFormat<T>> {
    return await getQuery<T>(this.config, params as any, signal);
  }

  /**
   * Get transaction status
   * @description Returns the status of a given transaction receipt by hash
   */
  async receiptByTransactionHash(
    params: ReceiptParams,
    signal?: Signal
  ): Promise<TransactionReceipt> {
    return await getTransactionReceipt(this.config, params, signal);
  }

  /**
   * Wait for transaction status
   * @description Polls for the status of a given transaction receipt by hash until
   */
  async pollForReceiptByTransactionHash(
    params: ReceiptParams,
    controller?: PollingController
  ): Promise<TransactionReceipt> {
    return await pollTransactionReceipt(this.config, params, controller);
  }
}
