import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import fetch from "node-fetch";
import { ChainName } from "@tableland/sdk";
import getChains from "../chains";

type Options = {
  // Local
  name: string;

  // Global
  chain: ChainName;
};

export const command = "info <name>";
export const desc = "Get info about a given table by name";

export const builder: CommandBuilder = (yargs) =>
  yargs.positional("name", {
    type: "string",
    description: "The target table name",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { name, chain } = argv;

  const network = getChains()[chain];
  if (!network) {
    console.error("unsupported chain (see `chains` command for details)\n");
    process.exit(1);
  }

  const parts = name.split("_");
  if (parts.length !== 3) {
    console.error(
      "invalid table name (name format is `prefix_chainId_tableId`)\n"
    );
    process.exit(1);
  }
  const chainId = parts[1];
  if (chainId !== (network.chainId as number).toString()) {
    console.error(
      "table `chainId` does not match selected chain (see `chains` command for details)\n"
    );
    process.exit(1);
  }
  const id = parts[2];

  const res = await fetch(
    `${network.host}/chain/${network.chainId}/tables/${id}`
  );
  const out = JSON.stringify(await res.json(), null, 2);
  console.log(out);
  process.exit(0);
};
