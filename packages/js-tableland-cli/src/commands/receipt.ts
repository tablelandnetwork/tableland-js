import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { connect, ConnectOptions, ChainName } from "@tableland/sdk";
import { getWallet } from "../utils";

type Options = {
  // Local
  hash: string;

  // Global
  rpcRelay: boolean;
  privateKey: string;
  chain: ChainName;
};

export const command = "receipt <hash>";
export const desc =
  "Get the receipt of a chain transaction to know if it was executed, and the execution details";

export const builder: CommandBuilder<Options, Options> = (yargs) =>
  yargs.positional("hash", {
    type: "string",
    description: "Transaction hash",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { hash, privateKey, chain, rpcRelay } = argv;

  try {
    const signer = getWallet({
      privateKey,
      chain,
      alchemy: undefined,
      infura: undefined,
      etherscan: undefined,
    });
    const options: ConnectOptions = {
      chain,
      rpcRelay,
      signer,
    };
    const res = await connect(options).receipt(hash);
    const out = JSON.stringify(res, null, 2);
    console.log(out);
    process.exit(0);
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
};
