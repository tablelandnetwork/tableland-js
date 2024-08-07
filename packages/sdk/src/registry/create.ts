import { Typed } from "ethers";
import { normalize } from "../helpers/index.js";
import { type SignerConfig } from "../helpers/config.js";
import {
  type ContractTransactionResponse,
  isPolygon,
} from "../helpers/ethers.js";
import { validateTableName } from "../helpers/parser.js";
import { getContractAndOverrides } from "./contract.js";

// Match _anything_ between create table and schema portion of create statement (statement must be a single line)
const firstSearch =
  /(?<create>^CREATE\s+TABLE\s+)(?<name>\S+)(?<schema>\s*\(.*\)[;]?$)/i;
const escapeChars = /"|'|`|\]|\[/;

export interface PrepareParams {
  /**
   * SQL statement string.
   */
  statement: string;
  /**
   * The target chain id.
   */
  chainId: number;
  /**
   * The first table name in a series of SQL statements.
   */
  first?: string;
}

export async function prepareCreateOne({
  statement,
  chainId,
  first,
}: PrepareParams): Promise<CreateOneParams & { prefix: string }> {
  if (first == null) {
    const normalized = await normalize(statement);
    first = normalized.tables[0];
  }

  const { prefix, name: tableName } = await validateTableName(
    `${first}_${chainId}`,
    true
  );
  const stmt = statement
    .replace(/\n/g, "")
    .replace(/\r/g, "")
    .replace(
      firstSearch,
      function (_, create: string, name: string, schema: string) {
        // If this name has any escape chars, escape the whole thing.
        const newName = escapeChars.test(name) ? `[${tableName}]` : tableName;
        return `${create.trim()} ${newName.trim()} ${schema.trim()}`;
      }
    );

  return { statement: stmt, chainId, prefix };
}

/**
 * CreateOneParams Represents the parameters Object used to create a single table.
 * @typedef {Object} CreateOneParams
 * @property {string} statement - SQL statement string.
 * @property {number} chainId - The target chain id.
 */
export interface CreateOneParams {
  statement: string;
  chainId: number;
}

/**
 * CreateManyParams Represents the parameters Object used to create multiple tables in a single tx.
 * @typedef {Object} CreateManyParams
 * @property {string[]} statements - List of create SQL statement strings.
 * @property {number} chainId - The target chain id.
 */
export interface CreateManyParams {
  statements: string[];
  chainId: number;
}

export type CreateParams = CreateOneParams | CreateManyParams;

export async function create(
  config: SignerConfig,
  params: CreateParams
): Promise<ContractTransactionResponse> {
  if (isCreateOne(params)) {
    return await _createOne(config, params);
  }
  return await _createMany(config, params);
}

async function _createOne(
  { signer }: SignerConfig,
  { statement, chainId }: CreateOneParams
): Promise<ContractTransactionResponse> {
  const owner = await signer.getAddress();
  const { contract, overrides } = await getContractAndOverrides(
    signer,
    chainId
  );
  /* c8 ignore next 8 */
  if (isPolygon(chainId)) {
    const gasLimit = await contract["create(address,string)"].estimateGas(
      Typed.address(owner),
      Typed.string(statement),
      overrides
    );
    overrides.gasLimit = Math.floor(Number(gasLimit) * 1.2);
  }
  return await contract["create(address,string)"](
    Typed.address(owner),
    Typed.string(statement),
    overrides
  );
}

async function _createMany(
  { signer }: SignerConfig,
  { statements, chainId }: CreateManyParams
): Promise<ContractTransactionResponse> {
  const owner = await signer.getAddress();
  const { contract, overrides } = await getContractAndOverrides(
    signer,
    chainId
  );
  // TODO: once ethers `Typed.array` is added, use it for `statements`
  /* c8 ignore next 8 */
  if (isPolygon(chainId)) {
    const gasLimit = await contract["create(address,string[])"].estimateGas(
      Typed.address(owner),
      statements,
      overrides
    );
    overrides.gasLimit = Math.floor(Number(gasLimit) * 1.2);
  }
  return await contract["create(address,string[])"](
    Typed.address(owner),
    statements,
    overrides
  );
}

const isCreateOne = function (params: CreateParams): params is CreateOneParams {
  return (params as CreateOneParams).statement !== undefined;
};
