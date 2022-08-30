import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import fetch from "node-fetch";
import { ChainName } from "@tableland/sdk";
import getChains from "../chains";

type Options = {
  // Local
  hash: string;

  // Global
  chain: ChainName;
};

export const command = "structure <hash>";
export const desc = "Get table name(s) by schema structure hash";

export const builder: CommandBuilder = (yargs) =>
  yargs.positional("hash", {
    type: "string",
    description: "The schema structure hash",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { hash, chain } = argv;

  const network = getChains()[chain];
  if (!network) {
    console.error("unsupported chain (see `chains` command for details)\n");
    process.exit(1);
  }

  try {
    const res = await fetch(
      `${network.host}/chain/${network.chainId}/tables/structure/${hash}`
    );
    const out = JSON.stringify(await res.json(), null, 2);
    console.log(out);
    process.exit(0);
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
};
