import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { Wallet } from "ethers";
import { connect, ConnectOptions, ChainName } from "@tableland/sdk";
import getChains from "../chains";

type Options = {
  // Local
  statement: string;

  // Global
  privateKey: string;
  chain: ChainName;
};

export const command = "write <statement>";
export const desc = "Run a mutating SQL statement against a remote table";

export const builder: CommandBuilder<Options, Options> = (yargs) =>
  yargs.positional("statement", {
    type: "string",
    description: "SQL write statement",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { statement, privateKey, chain } = argv;

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
    signer: new Wallet(privateKey),
  };
  const tbl = await connect(options);
  const res = await tbl.write(statement);
  const out = JSON.stringify(res, null, 2);
  process.stdout.write(`${out}\n`);
  process.exit(0);
};
