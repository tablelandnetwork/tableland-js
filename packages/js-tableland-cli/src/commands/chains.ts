import type { Arguments, CommandBuilder } from "yargs";
import { SUPPORTED_CHAINS } from "@tableland/sdk";

type Options = {
  // emopty
};

export const command = "chains";
export const desc = "List information about supported chains";

export const builder: CommandBuilder<Options, Options> = (yargs) => yargs;

export const handler = async (_argv: Arguments<Options>): Promise<void> => {
  const out = JSON.stringify(SUPPORTED_CHAINS, null, 2);
  console.log(out);
  process.exit(0);
};
