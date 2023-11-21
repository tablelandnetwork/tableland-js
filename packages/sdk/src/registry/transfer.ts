import { type SignerConfig } from "../helpers/config.js";
import { type ContractTransaction, isPolygon } from "../helpers/ethers.js";
import { type TableIdentifier, getContractSetup } from "./contract.js";

export interface TransferParams {
  /**
   * Name or tableId and chainId of the token to be transferred.
   */
  tableName: string | TableIdentifier;
  /**
   * Address to receive the ownership of the given token ID.
   */
  to: string;
}

export async function safeTransferFrom(
  { signer }: SignerConfig,
  params: TransferParams
): Promise<ContractTransaction> {
  const { contract, overrides, tableId } = await getContractSetup(
    signer,
    params.tableName
  );
  const caller = await signer.getAddress();
  const chainId = await signer.getChainId();
  if (isPolygon(chainId)) {
    const gasLimit = await contract.estimateGas[
      "safeTransferFrom(address,address,uint256)"
    ](caller, params.to, tableId, overrides);
    overrides.gasLimit = Math.floor(gasLimit.toNumber() * 1.2);
  }
  return await contract["safeTransferFrom(address,address,uint256)"](
    caller,
    params.to,
    tableId,
    overrides
  );
}
