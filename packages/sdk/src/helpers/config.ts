import { type WaitableTransactionReceipt } from "../registry/utils.js";
import { type FetchConfig } from "../validator/client/index.js";
import { type PollingController } from "./await.js";
import { type ChainName, getBaseUrl } from "./chains.js";
import { type Signer, type ExternalProvider, getSigner } from "./ethers.js";

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

// TODO: the `NameMapping`, `AliasesNameMapSync`, `AliasesNameMapAsync`, and
// `AliasesNameMap` types are duplicated from `@tableland/node-helpers`. We
// should move them to a shared location like `@tableland/types`.

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
