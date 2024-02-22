import {
  proxies,
  baseURIs,
  validatorPollingTimeouts,
  type TablelandNetworkConfig,
} from "@tableland/evm/network.js";
import { createPollingController, type PollingController } from "./await.js";

/**
 * The set of supported chain names as used by the Tableland network.
 */
export type ChainName = keyof TablelandNetworkConfig;

/**
 * Chain information used to determine defaults for the set of supported chains.
 * @property chainName The name of the chain as defined in {@link ChainName}.
 * @property chainId The chain ID.
 * @property contractAddress The registry contract address for the chain.
 * @property baseUrl The validator base URL for the chain.
 * @property pollingTimeout The validator polling timeout for the chain.
 * @property pollingInterval The validator polling interval for the chain.
 * @property [key: string] Any additional properties.
 */
export interface ChainInfo {
  chainName: ChainName;
  chainId: number;
  contractAddress: string;
  baseUrl: string;
  pollingTimeout: number;
  pollingInterval: number;
  [key: string]: ChainInfo[keyof ChainInfo];
}

// We simply pull this automatically from @tableland/evm to avoid keeping track separately here.
const entries = Object.entries(proxies) as Array<[ChainName, string]>;
const mapped = entries.map(([chainName, contractAddress]) => {
  // @ts-expect-error this imported object's values are always a string
  const uri = new URL(baseURIs[chainName]);
  const baseUrl = `${uri.protocol}//${uri.host}/api/v1`;
  const chainId = parseInt(
    uri.pathname
      .split("/")
      .filter((v) => v !== "")
      .pop() /* c8 ignore next */ ?? ""
  );
  // Use per-chain validator polling timeout period
  const pollingTimeout = validatorPollingTimeouts[chainName];
  // Default to 1500ms polling interval, except for Filecoin due to long block times
  const pollingInterval = chainName.includes("filecoin") ? 5000 : 1500;
  const entry: [ChainName, any] = [
    chainName,
    {
      chainName,
      chainId,
      contractAddress,
      baseUrl,
      pollingTimeout,
      pollingInterval,
    },
  ];
  return entry;
});

/**
 * The set of chains and their information as supported by the Tableland network.
 */
export const supportedChains = Object.fromEntries(mapped) as Record<
  ChainName,
  ChainInfo
>;

// Not exported
const supportedChainsById = Object.fromEntries(
  Object.values(supportedChains).map((v) => [v.chainId, v])
);

/**
 * Get the default chain information for a given chain name.
 * @param chainNameOrId The requested chain name or ID.
 * @returns An object containing the default chainId, contractAddress, chainName, and baseUrl for the given chain.
 */
export function getChainInfo(chainNameOrId: ChainName | number): ChainInfo {
  const chainInfo =
    typeof chainNameOrId === "number"
      ? supportedChainsById[chainNameOrId]
      : supportedChains[chainNameOrId];

  /* c8 ignore next 3 */
  if (chainInfo == null) {
    throw new Error(`cannot use unsupported chain: ${chainNameOrId}`);
  }

  return chainInfo;
}

/**
 * Get whether or not a chain is a testnet.
 * @param chainNameOrId The requested chain name or ID.
 * @returns An boolean to indicate the testnet classification of the given chain.
 */
export function isTestnet(chainNameOrId: ChainName | number): boolean {
  const includesTestnet =
    getChainInfo(chainNameOrId).baseUrl.includes("testnet");
  return (
    includesTestnet ||
    chainNameOrId === "localhost" ||
    chainNameOrId === "local-tableland" ||
    chainNameOrId === 31337
  );
}

/**
 * Get the default contract address for a given chain name.
 * @param chainNameOrId The requested chain name or ID.
 * @returns A hex string representing the default address for the Tableland registry contract.
 */
export function getContractAddress(chainNameOrId: ChainName | number): string {
  return getChainInfo(chainNameOrId).contractAddress;
}

/**
 * Get the default chain ID for a given chain name.
 * @param chainNameOrId The requested chain name or ID.
 * @returns A number representing the default chain ID of the requested chain.
 */
export function getChainId(chainNameOrId: ChainName | number): number {
  return getChainInfo(chainNameOrId).chainId;
}

/**
 * Get the default host uri for a given chain name.
 * @param chainNameOrId The requested chain name.
 * @returns A string representing the default host uri for a given chain.
 */
export function getBaseUrl(chainNameOrId: ChainName | number): string {
  return getChainInfo(chainNameOrId).baseUrl;
}

/**
 * Create a polling controller with chain-specific timeout & interval.
 * @param chainNameOrId The requested chain name.
 * @returns A {@link PollingController} with standard timeout & interval per-chain.
 */
export function getChainPollingController(
  chainNameOrId: ChainName | number
): PollingController {
  const { pollingTimeout, pollingInterval } = getChainInfo(chainNameOrId);
  return createPollingController(pollingTimeout, pollingInterval);
}

/**
 * Override the internal list of registry addresses and validator urls that will be used for Contract calls and read queries
 * @param chainNameOrId Either the chain name or chainId.  For a list of chain names see the evm-tableland networks file
 * @param values The values you would like to use to override the defaults.
 *  Example: {contractAddress: "0x000deadbeef", baseUrl: "https://my.validator.mydomain.tld"}
 * @returns void
 */
// TODO: It seems important to add this to the docs somewhere since it's the key
//    to using the SDK for the non-default Validator
export function overrideDefaults(
  chainNameOrId: ChainName | number,
  values: Record<keyof ChainInfo, number | string>
): void {
  if (values == null || typeof values !== "object") {
    throw new Error("override values must be an Object");
  }
  for (const [key, value] of Object.entries(values)) {
    if (typeof chainNameOrId === "number") {
      const found = getChainInfo(chainNameOrId);
      found[key] = value;
      supportedChains[found.chainName][key as keyof ChainInfo] = value;
    } else {
      const found = getChainInfo(chainNameOrId);
      found[key] = value;
      supportedChainsById[found.chainId][key as keyof ChainInfo] = value;
    }
  }
}
