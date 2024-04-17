import { Typed } from "ethers";
import { type SignerConfig, extractChainId } from "../helpers/config.js";
import { checkProvider } from "../helpers/ethers.js";
import { type TableIdentifier, getContractAndOverrides } from "./contract.js";

export async function listTables(
  { signer }: SignerConfig,
  owner?: string
): Promise<TableIdentifier[]> {
  const address = owner ?? (await signer.getAddress());
  const chainId = await extractChainId({ signer });
  checkProvider(signer);
  const { contract, overrides } = await getContractAndOverrides(
    signer,
    chainId
  );
  const tokens = await contract.tokensOfOwner(
    Typed.address(address),
    overrides
  );
  return tokens.map((token) => ({ tableId: token.toString(), chainId }));
}
