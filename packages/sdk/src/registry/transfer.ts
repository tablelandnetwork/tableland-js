import { Typed } from "ethers";
import { type SignerConfig, extractChainId } from "../helpers/config.js";
import {
  type ContractTransactionResponse,
  isPolygon,
} from "../helpers/ethers.js";
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
): Promise<ContractTransactionResponse> {
  const { contract, overrides, tableId } = await getContractSetup(
    signer,
    params.tableName
  );
  const caller = await signer.getAddress();
  const chainId = await extractChainId({ signer });
  if (isPolygon(chainId)) {
    const gasLimit = await contract[
      "safeTransferFrom(address,address,uint256)"
    ].estimateGas(
      Typed.address(caller),
      Typed.address(params.to),
      Typed.uint256(tableId),
      overrides
    );
    overrides.gasLimit = Math.floor(Number(gasLimit) * 1.2);
  }
  return await contract["safeTransferFrom(address,address,uint256)"](
    Typed.address(caller),
    Typed.address(params.to),
    Typed.uint256(tableId),
    overrides
  );
}
