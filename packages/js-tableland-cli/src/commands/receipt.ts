import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { Wallet } from "ethers";
import { connect, ConnectOptions, ChainName } from "@tableland/sdk";
import getChains from "../chains";

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

  if (!privateKey) {
    console.error("missing required flag (`-k` or `--privateKey`)\n");
    process.exit(1);
  }
  const network = getChains()[chain];
  if (!network) {
    console.error("unsupported chain (see `chains` command for details)\n");
    process.exit(1);
  }

  const options: ConnectOptions = {
    chain,
    rpcRelay,
    signer: new Wallet(privateKey),
  };
  const res = await connect(options).receipt(hash);
  const out = JSON.stringify(res, null, 2);
  console.log(out);
  process.exit(0);
};
