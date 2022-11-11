import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import fetch from "node-fetch";
import { ChainName } from "@tableland/sdk";
import { getChains } from "../utils.js";

export type Options = {
  // Local
  hash: string;

  // Global
  chain: ChainName;
};

export const command = "structure <hash>";
export const desc = "Get table name(s) by schema structure hash";

export const builder: CommandBuilder<{}, Options> = (yargs) =>
  yargs.positional("hash", {
    type: "string",
    description: "The schema structure hash",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { hash, chain } = argv;

  const network = getChains()[chain];
  if (!network) {
    console.error("unsupported chain (see `chains` command for details)");
    return;
  }

  try {
    const res = await fetch(
      `${network.host}/chain/${network.chainId}/tables/structure/${hash}`
    );
    const out = JSON.stringify(await res.json(), null, 2);
    console.log(out);
    /* c8 ignore next 3 */
  } catch (err: any) {
    console.error(err.message);
  }
};
