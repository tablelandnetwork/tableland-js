import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { connect, ConnectOptions, ChainName } from "@tableland/sdk";
import { getWallet, getLink } from "../utils.js";

type Options = {
  // Local
  statement: string;

  // Global
  rpcRelay: boolean;
  privateKey: string;
  chain: ChainName;
  alchemy: string | undefined;
  infura: string | undefined;
  etherscan: string | undefined;
};

export const command = "write <statement>";
export const desc = "Run a mutating SQL statement against a remote table";

export const builder: CommandBuilder<Options, Options> = (yargs) =>
  yargs.positional("statement", {
    type: "string",
    description: "SQL write statement",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { statement, privateKey, chain, alchemy, infura, etherscan, rpcRelay } =
    argv;

  try {
    const signer = getWallet({ privateKey, chain, infura, etherscan, alchemy });
    const options: ConnectOptions = {
      chain,
      rpcRelay,
      signer,
    };
    const res = await connect(options).write(statement);
    const link = getLink(chain, res.hash);
    const out = JSON.stringify({ ...res, link }, null, 2);
    console.log(out);
    process.exit(0);
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
};
