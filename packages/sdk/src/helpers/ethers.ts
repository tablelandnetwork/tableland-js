import {
  BrowserProvider,
  FeeData,
  getDefaultProvider,
  parseUnits,
  type ContractTransactionResponse,
  type ContractTransactionReceipt,
  type Eip1193Provider,
  type EventLog,
  type Log,
  type Overrides,
  type Signer,
} from "ethers";
import { type TransactionReceipt } from "../validator/receipt.js";
import { type SignerConfig } from "./config.js";
import { isTestnet } from "./chains.js";

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
  opts.maxFeePerGas = maxFeePerGas ?? null;
  opts.maxPriorityFeePerGas = maxPriorityFeePerGas ?? null;
  return opts;
}

/**
 * Check if a chain is Polygon.
 * @param chainId The chainId of the network as a number or bigint.
 * @returns A boolean that indicates if the chain is a mainnet/testnet Polygon.
 */
export function isPolygon(chainId: number | bigint): boolean {
  const chainIdNumber = typeof chainId === "bigint" ? Number(chainId) : chainId;
  return chainIdNumber === 137 || chainIdNumber === 80001;
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
  const events = logs.filter(isEventLog) ?? [];
  const transactionHash = receipt.hash;
  const blockNumber = receipt.blockNumber;
  const chainId = Number(tx.chainId);
  const tableIds: string[] = [];
  for (const event of events) {
    const tableId =
      event.args?.tableId != null && event.args.tableId.toString();
    switch (event.eventName) {
      case "CreateTable":
      case "RunSQL":
        if (tableId != null) tableIds.push(tableId);

        break;
      default:
      // Could be a Transfer or other
    }
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
  await provider.request({ method: "eth_requestAccounts" });
  const browserProvider = new BrowserProvider(provider);
  return await browserProvider.getSigner();
}

/**
 * Check if the signer has an attached provider (mimics ethers v5
 * `signer._checkProvider`).
 * @param signer A signer instance.
 */
export function checkProvider(signer: Signer): void {
  if (!signer.provider) {
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

export {
  getDefaultProvider,
  type Eip1193Provider,
  type ContractTransactionResponse,
  type ContractTransactionReceipt,
  type Signer,
};
