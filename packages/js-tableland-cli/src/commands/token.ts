import type { Arguments, CommandBuilder } from "yargs";
import { Wallet } from "ethers";
import { userCreatesToken, ChainName } from "@tableland/sdk";
import getChains from "../chains";

type Options = {
  // Global
  privateKey: string;
  chain: ChainName;
};

export const command = "token";
export const desc = "Create a SIWE token";

export const builder: CommandBuilder<Options, Options> = (yargs) => yargs;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { privateKey, chain } = argv;

  if (!privateKey) {
    console.error("missing required flag (`-k` or `--privateKey`)\n");
    process.exit(1);
  }
  const network = getChains()[chain];
  if (!network) {
    console.error("unsupported chain (see `chains` command for details)\n");
    process.exit(1);
  }

  const signer = new Wallet(privateKey);
  const { token } = await userCreatesToken(signer, network.chainId);
  const out = JSON.stringify(token, null, 2);
  console.log(out);
  process.exit(0);
};
