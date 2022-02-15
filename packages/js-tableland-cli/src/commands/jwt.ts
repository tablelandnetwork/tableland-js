import type { Arguments, CommandBuilder } from "yargs";
import { Wallet } from "ethers";
import { connect } from "@textile/tableland";

type Options = {
  // Global
  privateKey: string;
};

export const command = "jwt";
export const desc = "Create a signed JWT token";

export const builder: CommandBuilder<Options, Options> = (yargs) => yargs;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { privateKey } = argv;
  const signer = new Wallet(privateKey);
  const { token } = await connect({ signer });

  const out = JSON.stringify(token, null, 2);
  process.stdout.write(`${out}\n`);
  process.exit(0);
};
