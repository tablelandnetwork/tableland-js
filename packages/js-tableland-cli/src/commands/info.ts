import yargs, { Arguments, CommandBuilder } from "yargs";
import fetch from "node-fetch";
import { ChainName, SUPPORTED_CHAINS } from "@tableland/sdk";

type Options = {
  // Local
  id: string;

  // Global
  host: string;
  chain: ChainName;
};

export const command = "info <id>";
export const desc = "Get info about a given table by id";

export const builder: CommandBuilder = (yargs) =>
  yargs.positional("id", {
    type: "string",
    description: "The target table id",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { host, id, chain } = argv;
  const chainId = SUPPORTED_CHAINS[chain]?.chainId;
  if (!chainId) {
    console.error("unsupported chain. see `chains` command for details");
    process.exit(1);
  }
  const res = await fetch(`${host}/chain/${chainId}/tables/${id}`);
  const out = JSON.stringify(await res.json(), null, 2);
  console.log(out);
  process.exit(0);
};
