import yargs, { Arguments, CommandBuilder } from "yargs";
import { Wallet } from "ethers";
import fetch from "node-fetch";
import { ChainName, SUPPORTED_CHAINS } from "@tableland/sdk";

type Options = {
  // Local
  address: string;

  // Global
  privateKey: string;
  host: string;
  chain: ChainName;
};

export const command = "list [address]";
export const desc = "List tables by address";

export const builder: CommandBuilder<Options, Options> = (yargs) => {
  return yargs.positional("address", {
    type: "string",
    description: "The target address",
  }) as yargs.Argv<Options>;
};

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { privateKey, host, chain } = argv;
  let { address } = argv;
  if (!address) {
    if (privateKey) {
      address = new Wallet(privateKey).address;
    } else {
      console.error("must supply `--privateKey` or `address` positional\n");
      process.exit(1);
    }
  }
  const chainId = SUPPORTED_CHAINS[chain].chainId ?? 5;
  const res = await fetch(
    `${host}/chain/${chainId}/tables/controller/${address}`
  );
  const out = JSON.stringify(await res.json(), null, 2);
  console.log(out);
  process.exit(0);
};
