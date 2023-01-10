import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { ChainName, Validator, getChainId } from "@tableland/sdk";
import { getChains } from "../utils.js";

export type Options = {
  // Local
  hash: string;

  // Global
  privateKey: string;
  chain: ChainName;
};

export const command = "receipt <hash>";
export const desc =
  "Get the receipt of a chain transaction to know if it was executed, and the execution details";

export const builder: CommandBuilder<{}, Options> = (yargs) =>
  yargs.positional("hash", {
    type: "string",
    description: "Transaction hash",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { hash, chain } = argv;

  const network = getChains()[chain];
  if (!network) {
    console.error("unsupported chain (see `chains` command for details)");
    return;
  }

  try {
    const v = Validator.forChain(chain);
    const res = await v.receiptByTransactionHash({
      chainId: getChainId(chain),
      transactionHash: hash,
    });
    console.log(res);
    /* c8 ignore next 3 */
  } catch (err: any) {
    console.error(err.message);
  }
};
