import {
  type Camelize,
  type PartialRequired,
  camelize,
} from "../helpers/utils.js";
import {
  type AsyncFunction,
  type PollingController,
  type Signal,
  getAsyncPoller,
} from "../helpers/await.js";
import { getChainPollingController } from "../helpers/chains.js";
import { hoistApiError } from "./errors.js";
import {
  type Components,
  type FetchConfig,
  type Paths,
  getFetcher,
  ApiError,
} from "./client/index.js";

export type Params =
  Paths["/receipt/{chainId}/{transactionHash}"]["get"]["parameters"]["path"];

type Response = Components["schemas"]["TransactionReceipt"];
type AssertedResponse = PartialRequired<Response, "error_event_idx" | "error">;
export type TransactionReceipt = Camelize<AssertedResponse>;

function assertResponse(obj: Response): obj is AssertedResponse {
  return (
    obj.block_number != null &&
    obj.chain_id != null &&
    obj.transaction_hash != null &&
    /* c8 ignore next */
    (obj.table_id != null || obj.error != null || obj.error_event_idx != null)
  );
}

function transformResponse(obj: Response): TransactionReceipt {
  if (assertResponse(obj)) {
    return camelize(obj);
  }
  /* c8 ignore next 2 */
  throw new Error("malformed transaction receipt response");
}

export async function getTransactionReceipt(
  config: FetchConfig,
  params: Params,
  signal?: Signal
): Promise<TransactionReceipt> {
  const receiptByTransactionHash = getFetcher(config)
    .path("/receipt/{chainId}/{transactionHash}")
    .method("get")
    .create();
  const { data } = await receiptByTransactionHash(params, signal).catch(
    hoistApiError
  );
  const transformed = transformResponse(data);
  return transformed;
}

export async function pollTransactionReceipt(
  config: FetchConfig,
  params: Params,
  controller?: PollingController
): Promise<TransactionReceipt> {
  const receiptByTransactionHash = getFetcher(config)
    .path("/receipt/{chainId}/{transactionHash}")
    .method("get")
    .create();
  const fn: AsyncFunction<TransactionReceipt> = async () => {
    try {
      const { data: obj } = await receiptByTransactionHash(params, {
        signal: controller?.signal,
      }).catch(hoistApiError);
      const data = transformResponse(obj);
      return { done: true, data };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return { done: false };
      }
      /* c8 ignore next */
      throw err;
    }
  };
  const control = controller ?? getChainPollingController(params.chainId);
  const receipt = await getAsyncPoller(fn, control);
  return receipt;
}
