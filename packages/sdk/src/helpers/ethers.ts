import {
  BrowserProvider,
  FeeData,
  getDefaultProvider,
  JsonRpcProvider,
  Network,
  parseUnits,
  Wallet,
  type ContractTransactionResponse,
  type ContractTransactionReceipt,
  type Eip1193Provider,
  type EventLog,
  type JsonRpcApiProviderOptions,
  type Log,
  type Overrides,
  type Signer,
} from "ethers";
import { type TransactionReceipt } from "../validator/receipt.js";
import { contractEventsTableIdx } from "./subscribe.js";
import { type SignerConfig } from "./config.js";
import { type ChainName, getChainInfo, isTestnet } from "./chains.js";

// eslint-disable-next-line @typescript-eslint/no-namespace
declare module globalThis {
  // eslint-disable-next-line no-var
  var ethereum: Eip1193Provider | undefined;
}

/**
 * Response for current gas fee data from the Amoy gas station API at:
 * https://gasstation-testnet.polygon.technology/amoy (testnet) &
 * https://gasstation.polygon.technology/v2 (mainnet)
 */
interface PolygonFeeData {
  safeLow: {
    maxPriorityFee: number;
    maxFee: number;
  };
  standard: {
    maxPriorityFee: number;
    maxFee: number;
  };
  fast: {
    maxPriorityFee: number;
    maxFee: number;
  };
  estimatedBaseFee: number;
  blockTime: number;
  blockNumber: number;
}

/**
 * Fetches the current gas fee data for a connected network.
 * @param signer A signer instance.
 * @returns Current gas fee information for the network.
 */
export async function getFeeData(signer: Signer): Promise<FeeData> {
  const network = await signer.provider?.getNetwork();
  const chainId = network?.chainId;
  // Use custom Polygon gas data, else, use built-in ethers method
  try {
    if (chainId && isPolygon(chainId)) {
      const url = isTestnet(Number(chainId))
        ? "https://gasstation-testnet.polygon.technology/amoy"
        : "https://gasstation.polygon.technology/v2";
      const response = await fetch(url);
      const data: PolygonFeeData = await response.json();
      const feeData = new FeeData(
        null, // No gas price value needed
        BigInt(parseUnits(String(data.standard.maxFee), "gwei")),
        BigInt(parseUnits(String(data.standard.maxPriorityFee), "gwei"))
      );
      return feeData;
    } else {
      const feeData = await signer.provider?.getFeeData();
      return feeData ?? new FeeData();
    }
  } catch {
    return new FeeData(); // Return null values if fee data is not available
  }
}

/**
 * Request a set of opinionated overrides to be used when calling the Tableland contract.
 * @param signer A valid web3 provider/signer.
 * @returns A promise that resolves to an object with overrides.
 */
export async function getOverrides({
  signer,
}: SignerConfig): Promise<Overrides> {
  // TODO: validate passing max fee params work the same as gasPrice bump by 10%
  const opts: Overrides = {};
  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeData(signer);
  opts.maxFeePerGas = maxFeePerGas;
  opts.maxPriorityFeePerGas = maxPriorityFeePerGas;
  return opts;
}

/**
 * Check if a chain is Polygon.
 * @param chainId The chainId of the network as a number or bigint.
 * @returns A boolean that indicates if the chain is a mainnet/testnet Polygon.
 */
export function isPolygon(chainId: number | bigint): boolean {
  const chainIdNumber = typeof chainId === "bigint" ? Number(chainId) : chainId;
  return chainIdNumber === 137 || chainIdNumber === 80002;
}

/**
 * RegistryReceipt is based on the TransactionReceipt type which defined by the API spec.
 * The API v1 has a known problem where it only returns the first tableId from a transaction.
 */
export type RegistryReceipt = Required<
  Omit<TransactionReceipt, "error" | "errorEventIdx">
>;

/**
 * MultiEventTransactionReceipt represents a mapping of a response from a Validator
 * transaction receipt to the tableIds that were affected.
 * @typedef {Object} MultiEventTransactionReceipt
 * @property {string[]} tableIds - The list of table ids affected in the transaction
 * @property {string} transactionHash - The hash of the transaction
 * @property {number} blockNumber - The block number of the transaction
 * @property {number} chainId - The chain id of the transaction
 */
export interface MultiEventTransactionReceipt {
  tableIds: string[];
  transactionHash: string;
  blockNumber: number;
  chainId: number;
}

/**
 * Given a transaction, this helper will return the tableIds that were part of the transaction.
 * Especially useful for transactions that create new tables because you need the tableId to
 * calculate the full table name.
 * @param {tx} a contract transaction
 * @returns {MultiEventTransactionReceipt} tableland receipt
 *
 */
export async function getContractReceipt(
  tx: ContractTransactionResponse
): Promise<MultiEventTransactionReceipt> {
  const receipt = await tx.wait();
  if (receipt == null) {
    throw new Error(
      `could not get receipt for transaction: ${JSON.stringify(tx, null, 4)}`
    );
  }

  /* c8 ignore next */
  const logs = receipt?.logs ?? [];
  console.log(receipt);
  const events = logs.filter(isEventLog) ?? [];
  const transactionHash = receipt.hash;
  const blockNumber = receipt.blockNumber;
  const chainId = Number(tx.chainId);
  const tableIds: string[] = [];
  for (const event of events) {
    const args = event.args;
    switch (event.eventName) {
      case "CreateTable":
        tableIds.push(
          String(args[contractEventsTableIdx.CreateTable.tableIdIndex])
        );
        break;
      case "RunSQL":
        tableIds.push(String(args[contractEventsTableIdx.RunSQL.tableIdIndex]));
        break;
      case "TransferTable":
        tableIds.push(
          String(args[contractEventsTableIdx.TransferTable.tableIdIndex])
        );
        break;
      case "SetController":
        tableIds.push(
          String(args[contractEventsTableIdx.SetController.tableIdIndex])
        );
        break;
      default:
      // Could be a non-ITablelandTables event (e.g., `Transfer`)
    }
    // Remove duplicates
    tableIds.filter((value, index, self) => self.indexOf(value) === index);
  }
  return { tableIds, transactionHash, blockNumber, chainId };
}

/**
 * Request a signer object from the global ethereum object.
 * @param external A valid external provider. Defaults to `globalThis.ethereum` if not provided.
 * @returns A promise that resolves to a valid web3 provider/signer
 * @throws If no global ethereum object is available.
 */
export async function getSigner(external?: Eip1193Provider): Promise<Signer> {
  const provider = external ?? globalThis.ethereum;
  if (provider == null) {
    throw new Error("provider error: missing global ethereum provider");
  }
  if (provider.request == null) {
    throw new Error(
      "provider error: missing request method on ethereum provider"
    );
  }
  const browserProvider = new BrowserProvider(provider);
  // Calling `browserProvider.getSigner` leads to a loop of annoying logging:
  // `JsonRpcProvider failed to detect network and cannot start up; retry in 1s
  // (perhaps the URL is wrong or the node is not started)`. Calling
  // `_detectNetwork` here ensures this doesn't happen, but follow here for
  // this issue getting resolved in the future:
  // https://github.com/ethers-io/ethers.js/issues/4377#issuecomment-2023855491
  await browserProvider._detectNetwork();
  const signer = await browserProvider.getSigner();

  return signer;
}

/**
 * Check if the signer has an attached provider (mimics ethers v5
 * `signer._checkProvider`).
 * @param signer A signer instance.
 */
export function checkProviderOfSigner(signer: Signer): void {
  if (signer.provider == null) {
    throw new Error("missing provider: cannot connect to contract");
  }
}

/**
 * Check if a log value is an ether `EventLog`.
 * @param logOrEvent Response from `ContractTransactionResponse` awaited receipt that
 * includes both `Log` and `EventLog` types.
 * @returns
 */
export function isEventLog(logOrEvent: EventLog | Log): logOrEvent is EventLog {
  return "args" in logOrEvent;
}

/**
 * Create a signer with a private key, a provider URL, and a chain. Optionally,
 * pass the chain name or ID to create a static network and reduce calls made by
 * the provider (by not checking the chain ID).
 * @param privateKey The private key of the signer.
 * @param providerUrl The URL of the provider.
 * @param chainNameOrId The chain name or ID.
 * @param options Optional settings for the provider. See ethersjs
 * {@link JsonRpcApiProviderOptions} for more information.
 */
export function createSigner({
  privateKey,
  providerUrl,
  chainNameOrId,
  options = {},
}: {
  privateKey: string;
  providerUrl: string;
  chainNameOrId?: ChainName | number;
  options?: JsonRpcApiProviderOptions;
}): Signer {
  const wallet = new Wallet(privateKey);
  let network: Network | undefined;
  // Presume a static network if `chainNameOrId` is provided, which reduces the
  // number of `eth_chainId` calls since the network is bound to the provider
  const staticNetwork = chainNameOrId != null;
  if (chainNameOrId != null) {
    const { chainName, chainId } = getChainInfo(chainNameOrId);
    network = new Network(chainName, chainId);
  }
  const provider = new JsonRpcProvider(providerUrl, network, {
    staticNetwork,
    ...options,
  });
  const signer = wallet.connect(provider);
  return signer;
}

export {
  getDefaultProvider,
  type Eip1193Provider,
  type ContractTransactionResponse,
  type ContractTransactionReceipt,
  type Signer,
};
