import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { Wallet } from "ethers";
import { ChainName, Registry } from "@tableland/sdk";
import { getChains, getWalletWithProvider } from "../utils.js";

export type Options = {
  // Local
  address: string;

  // Global
  privateKey: string;
  chain: ChainName;
  providerUrl: string;
};

export const command = "list [address]";
export const desc = "List tables by address";

export const builder: CommandBuilder<{}, Options> = (yargs) => {
  return yargs.positional("address", {
    type: "string",
    description: "The target address",
  }) as yargs.Argv<Options>;
};

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { privateKey, chain, providerUrl } = argv;
  let { address } = argv;

  if (!address) {
    if (privateKey) {
      address = new Wallet(privateKey).address;
    } else {
      console.error("must supply `--privateKey` or `address` positional");
      return;
    }
  }
  const network = getChains()[chain];
  if (!network) {
    console.error("unsupported chain (see `chains` command for details)");
    return;
  }

  try {
    const signer = getWalletWithProvider({
      privateKey,
      chain,
      providerUrl,
    });
    const reg = new Registry({ signer });

    const res = await reg.listTables(address);

    console.log(res);
    /* c8 ignore next 3 */
  } catch (err: any) {
    console.error(err.message);
  }
};
