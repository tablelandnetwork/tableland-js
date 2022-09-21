import type { Arguments, CommandBuilder } from "yargs";
import getChains from "../chains.js";

type Options = {
  // empty
};

export const command = "chains";
export const desc = "List information about supported chains";

export const builder: CommandBuilder<Options, Options> = (yargs) => yargs;

export const handler = async (_argv: Arguments<Options>): Promise<void> => {
  const out = JSON.stringify(getChains(), null, 2);
  console.log(out);
  process.exit(0);
};
