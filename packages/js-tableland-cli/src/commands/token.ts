import type { Arguments, CommandBuilder } from "yargs";
import { Wallet } from "ethers";
import { userCreatesToken, SUPPORTED_CHAINS, ChainName } from "@tableland/sdk";

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
  const signer = new Wallet(privateKey);
  const chainId = SUPPORTED_CHAINS[chain].chainId ?? 5;

  const { token } = await userCreatesToken(signer, chainId);
  const out = JSON.stringify(token, null, 2);
  console.log(out);
  process.exit(0);
};
