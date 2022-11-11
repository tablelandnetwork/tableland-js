import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import fetch from "node-fetch";
import { getChains } from "../utils.js";

export type Options = {
  // Local
  name: string;
};

export const command = "info <name>";
export const desc = "Get info about a given table by name";

export const builder: CommandBuilder<{}, Options> = (yargs) =>
  yargs.positional("name", {
    type: "string",
    description: "The target table name",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { name } = argv;

  const parts = name.split("_");
  if (parts.length < 3) {
    console.error(
      "invalid table name (name format is `{prefix}_{chainId}_{tableId}`)"
    );
    return;
  }

  const id = parts.pop()!;
  const chain = parseInt(parts.pop()!);
  const network = Object.values(getChains()).find(
    ({ chainId }) => chainId === chain
  );
  if (!network) {
    console.error("unsupported chain (see `chains` command for details)");
    return;
  }

  try {
    const res = await fetch(`${network.host}/chain/${chain}/tables/${id}`);
    const body: any = await res.json();
    if (body.message) {
      console.error(body.message);
    } else {
      const out = JSON.stringify(body, null, 2);
      console.log(out);
    }
    /* c8 ignore next 3 */
  } catch (err: any) {
    console.error(err.message);
  }
};
