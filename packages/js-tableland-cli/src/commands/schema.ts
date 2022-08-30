import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import fetch from "node-fetch";
import { SUPPORTED_CHAINS } from "@tableland/sdk";

type Options = {
  // Local
  name: string;
};

export const command = "schema <name>";
export const desc = "Get info about a given table schema";

export const builder: CommandBuilder = (yargs) =>
  yargs.positional("name", {
    type: "string",
    description: "The target table name",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { name } = argv;

  const parts = name.split("_");
  if (parts.length < 3) {
    console.error(
      "invalid table name (name format is `{prefix}_{chainId}_{tableId}`)\n"
    );
    process.exit(1);
  }

  parts.pop()!;
  const chainId = parseInt(parts.pop()!);
  const network = Object.values(SUPPORTED_CHAINS).find(
    (v) => v.chainId === chainId
  );
  if (!network) {
    console.error("unsupported chain (see `chains` command for details)\n");
    process.exit(1);
  }

  try {
    const res = await fetch(`${network.host}/schema/${name}`);
    const out = JSON.stringify(await res.json(), null, 2);
    console.log(out);
    process.exit(0);
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
};
