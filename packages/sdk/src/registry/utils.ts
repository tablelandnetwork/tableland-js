import {
  type TransactionReceipt,
  pollTransactionReceipt,
} from "../validator/receipt.js";
import { type Runnable } from "../registry/index.js";
import { normalize } from "../helpers/index.js";
import { type PollingController, type Wait } from "../helpers/await.js";
import {
  type Config,
  type ReadConfig,
  extractBaseUrl,
  extractChainId,
} from "../helpers/config.js";
import {
  type ContractTransactionResponse,
  getContractReceipt,
} from "../helpers/ethers.js";
import { validateTables, type StatementType } from "../helpers/parser.js";

/**
 * WaitableTransactionReceipt represents a named TransactionReceipt with a wait method.
 * See the Validator spec in the docs for more details.
 * @typedef {Object} WaitableTransactionReceipt
 * @property {function} wait - Async function that will not return until the validator has processed tx.
 * @property {string} name - The full table name.
 * @property {string} prefix - The table name prefix.
 * @property {number} chainId - The chainId of tx.
 * @property {string} tableId - The tableId of tx.
 * @property {string} transaction_hash - The transaction hash of tx.
 * @property {number} block_number - The block number of tx.
 * @property {Object} error - The first error encounntered when the Validator processed tx.
 * @property {number} error_event_idx - The index of the event that cause the error when the Validator processed tx.
 */
export type WaitableTransactionReceipt = TransactionReceipt &
  Wait<TransactionReceipt & Named> &
  Named;

/**
 * Named represents a named table with a prefix.
 */
export interface Named {
  /**
   * @custom:deprecated First table's full name.
   */
  name: string;
  /**
   * @custom:deprecated First table name prefix.
   */
  prefix: string;
  /**
   * The full table names
   */
  names: string[];
  /**
   * The table prefixes
   */
  prefixes: string[];
}

/**
 * ExtractedStatement represents a SQL statement string with the type and tables extracted.
 */
export interface ExtractedStatement {
  /**
   * SQL statement string.
   */
  sql: string;
  /**
   * List of table names referenced within the statement.
   */
  tables: string[];
  /**
   * The statement type. Must be one of "read", "write", "create", or "acl".
   */
  type: StatementType;
}

function isTransactionReceipt(arg: any): arg is WaitableTransactionReceipt {
  return (
    !Array.isArray(arg) &&
    arg.transactionHash != null &&
    arg.tableId != null &&
    arg.chainId != null &&
    arg.blockNumber != null &&
    typeof arg.wait === "function"
  );
}

/**
 * Wrap results for a Statement `run` or `all` call, or a Database `batch` call.
 * @param resultsOrReceipt Either query results or the transaction receipt.
 * @param duration Total client-side duration of the async call.
 * @returns Wrapped results with metadata.
 */
export function wrapResult<T = unknown>(
  resultsOrReceipt: T[] | WaitableTransactionReceipt,
  duration: number
): Result<T> {
  const meta: Metadata = { duration };
  const result: Result<T> = {
    meta,
    success: true,
    results: [],
    error: undefined,
  };
  if (isTransactionReceipt(resultsOrReceipt)) {
    return { ...result, meta: { ...meta, txn: resultsOrReceipt } };
  }
  return { ...result, results: resultsOrReceipt };
}

/**
 * Wrap results for a Database `exec` call.
 * @param result The result of the a {@link wrapResult} call, made by `exec` under the hood.
 * @param count The count of executed statements.
 * @returns Wrapped {@link ExecResult} with metadata and transaction
 * receipt or query results.
 */
export function wrapExecResult<T = unknown>(
  result: Result<T>,
  count: number
): ExecResult<T> {
  const { duration } = result.meta;
  const execResult: ExecResult<T> = {
    count,
    duration,
  };
  if (result.meta.txn != null) {
    return { ...execResult, txn: result.meta.txn };
  }
  return { ...execResult, results: result.results };
}

/**
 * Metadata represents meta information about an executed statement/transaction.
 */
export interface Metadata {
  /**
   * Total client-side duration of the async call.
   */
  duration: number;
  /**
   * The optional transaction information receipt.
   */
  txn?: WaitableTransactionReceipt;
  /**
   * Metadata may constrain additional arbitrary key/values pairs.
   */
  [key: string]: any;
}

/**
 * Result represents the core return result for an executed statement.
 */
export interface Result<T = unknown> {
  /**
   * Possibly empty list of query results.
   */
  results: T[];
  /**
   * Whether the query or transaction was successful.
   */
  success: true; // TODO: this is a bug in D1, but if we want to be compatible
  //       we have to type it like this :<
  //       https://github.com/cloudflare/workerd/issues/940
  /**
   * If there was an error, this will contain the error string.
   */
  error: undefined;
  /**
   * Additional meta information.
   */
  meta: Metadata;
}

/**
 * ExecResult represents the return result for executed Database statements via `exec()`.
 */
export interface ExecResult<T = unknown>
  extends Pick<Metadata, "duration" | "txn"> {
  /**
   * The count of executed statements.
   */
  count: number;
  /**
   * The optional list of query results.
   */
  results?: T[];
}

export async function extractReadonly(
  conn: Config,
  { tables, type }: Omit<ExtractedStatement, "sql">
): Promise<ReadConfig> {
  const [{ chainId }] = await validateTables({ tables, type });
  const baseUrl = await extractBaseUrl(conn, chainId);
  return { baseUrl, apiKey: conn.apiKey };
}

/**
 * Given a config, a table name prefix, and a transaction that only affects a single table
 * this will enable waiting for the Validator to materialize the change in the transaction
 * @param {Object} conn - A Database config.
 * @param {string} prefix - A table name prefix.
 * @param {Object} tx - A transaction object that includes a call to the Registry Contract.
 * @returns {WaitableTransactionReceipt}
 */
export async function wrapTransaction(
  conn: Config,
  prefix: string,
  tx: ContractTransactionResponse
): Promise<WaitableTransactionReceipt> {
  // TODO: next major we should combine this with wrapManyTransaction
  const _params = await getContractReceipt(tx);
  const chainId =
    _params.chainId === 0 || _params.chainId == null
      ? await extractChainId(conn)
      : _params.chainId;
  const name = `${prefix}_${chainId}_${_params.tableIds[0]}`;
  const params = { ..._params, chainId, tableId: _params.tableIds[0] };
  const wait = async (
    controller?: PollingController
  ): Promise<TransactionReceipt & Named> => {
    const receipt = await pollTransactionReceipt(conn, params, controller);
    if (receipt.error != null) {
      throw new Error(receipt.error);
    }
    return { ...receipt, name, prefix, prefixes: [prefix], names: [name] };
  };
  return { ...params, wait, name, prefix, prefixes: [prefix], names: [name] };
}

/* A helper function for mapping contract event receipts to table data
 *
 * @param {conn} a database config object
 * @param {statements} either the sql statement strings or the nomralized statement objects that were used in the transaction
 * @param {tx} the transaction object
 * @returns {(WaitableTransactionReceipt & Named)}
 *
 */
export async function wrapManyTransaction(
  conn: Config,
  statements: string[] | Runnable[],
  tx: ContractTransactionResponse
): Promise<WaitableTransactionReceipt & Named> {
  const _params = await getContractReceipt(tx);
  const chainId =
    _params.chainId === 0 || _params.chainId == null
      ? await extractChainId(conn)
      : _params.chainId;

  // map the transaction events to table names and prefixes then return them to the caller
  const { names, prefixes } = (
    await Promise.all(
      _params.tableIds.map(async function (tableId: string, i: number) {
        const statementString = isRunnable(statements[i])
          ? (statements[i] as Runnable).statement
          : (statements[i] as string);
        const normalized = await normalize(statementString);

        if (normalized.type === "create") {
          return {
            name: `${normalized.tables[0]}_${chainId}_${tableId}`,
            prefix: normalized.tables[0],
          };
        }
        return {
          name: normalized.tables[0],
          prefix: normalized.tables[0].split("_").slice(0, -2).join("_"),
        };
      })
    )
  ).reduce<{ prefixes: string[]; names: string[] }>(
    function (acc, cur) {
      acc.prefixes.push(cur.prefix);
      acc.names.push(cur.name);
      return acc;
    },
    { prefixes: [], names: [] }
  );

  const params = { ..._params, chainId };
  // TODO: including `name`, `prefix`, and `tableId` for back compat, will be removed next major
  const tableMeta = {
    names,
    name: names[0],
    tableId: _params.tableIds[0],
    prefixes,
    prefix: prefixes[0],
  };

  const wait = async (
    controller?: PollingController
  ): Promise<TransactionReceipt & Named> => {
    const receipt = await pollTransactionReceipt(conn, params, controller);
    if (receipt.error != null) {
      throw new Error(receipt.error);
    }

    return {
      ...receipt,
      ...tableMeta,
    };
  };

  return {
    ...params,
    wait,
    ...tableMeta,
  };
}

function isRunnable(statement: string | Runnable): statement is Runnable {
  return (statement as Runnable).tableId !== undefined;
}
