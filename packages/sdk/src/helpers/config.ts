import { type WaitableTransactionReceipt } from "../registry/utils.js";
import { type FetchConfig } from "../validator/client/index.js";
import { type PollingController } from "./await.js";
import { type ChainName, getBaseUrl } from "./chains.js";
import { type Signer, type ExternalProvider, getSigner } from "./ethers.js";
import { isPromise } from "./utils.js";

export interface ReadConfig {
  baseUrl: string;
  aliases?: AliasesNameMap;
  apiKey?: string;
}

export interface SignerConfig {
  signer: Signer;
}

export interface AutoWaitConfig {
  autoWait: boolean;
}

export type Config = Partial<ReadConfig & SignerConfig>;

/**
 * A series of mappings from a table alias to its globally unique table name.
 */
export type NameMapping = Record<string, string>;

/**
 * Used to read and write table aliases within a `Database` instance
 * @property read A function that returns a {@link NameMapping} object, or a
 * `Promise` of a {@link NameMapping} object.
 * @property write A function that accepts a {@link NameMapping} object and
 * returns `void`, or a Promise of void.
 */
export interface AliasesNameMap {
  read: (() => Promise<NameMapping>) | (() => NameMapping);
  write: ((map: NameMapping) => Promise<void>) | ((map: NameMapping) => void);
}

export async function checkWait(
  config: Config & Partial<AutoWaitConfig>,
  receipt: WaitableTransactionReceipt,
  controller?: PollingController
): Promise<WaitableTransactionReceipt> {
  if (config.autoWait ?? false) {
    const waited = await receipt.wait(controller);
    return { ...receipt, ...waited };
  }
  return receipt;
}

export async function extractBaseUrl(
  conn: Config = {},
  chainNameOrId?: ChainName | number
): Promise<string> {
  if (conn.baseUrl == null) {
    if (conn.signer == null) {
      if (chainNameOrId == null) {
        throw new Error(
          "missing connection information: baseUrl, signer, or chainId required"
        );
      }
      return getBaseUrl(chainNameOrId);
    }
    const chainId = await conn.signer.getChainId();
    return getBaseUrl(chainId);
  }
  return conn.baseUrl;
}

export async function extractSigner(
  conn: Config = {},
  external?: ExternalProvider
): Promise<Signer> {
  if (conn.signer == null) {
    return await getSigner(external);
  }
  return conn.signer;
}

export async function extractChainId(conn: Config = {}): Promise<number> {
  const signer = await extractSigner(conn);
  const chainId = await signer.getChainId();

  if (chainId === 0 || isNaN(chainId) || chainId == null) {
    /* c8 ignore next 4 */
    throw new Error(
      "cannot find chainId: is your signer connected to a network?"
    );
  }

  return chainId;
}

export function prepReadConfig(config: Partial<ReadConfig>): FetchConfig {
  const conf: FetchConfig = {};
  if (config.apiKey) {
    conf.init = {
      headers: {
        "Api-Key": config.apiKey,
      },
    };
  }

  return { ...config, ...conf };
}

/**
 * Read the {@link NameMapping} from an {@link AliasesNameMap}, which can
 * support either synchronous or asynchronous `read()` execution. It will wrap a
 * synchronous name mapping result, or wrap an unwrapped name mapping if
 * asynchronous.
 * @param aliases An `AliasesNameMap` object.
 * @returns A promise containing a `NameMapping` object.
 */
export async function readNameMapping(
  aliases: AliasesNameMap
): Promise<NameMapping> {
  const nameMap = aliases.read();
  return isPromise(nameMap) ? await nameMap : nameMap;
}

/**
 * Write table aliases with an {@link AliasesNameMap} and a provided
 * {@link NameMapping}, which can support either synchronous or asynchronous
 * `write()` execution. It will wrap a synchronous result, or wrap an unwrapped
 * result if asynchronous.
 * @param aliases An `AliasesNameMap` object to write to.
 * @param nameMap A `NameMapping` object to write to the `AliasesNameMap`.
 * @returns A promise containing `void` upon write completion.
 */
export async function writeNameMapping(
  aliases: AliasesNameMap,
  nameMap: NameMapping
): Promise<void> {
  const result = aliases.write(nameMap);
  return isPromise(result) ? await result : result;
}
