import type { Arguments, CommandBuilder } from "yargs";
import { getChains } from "../utils.js";

export type Options = {
  // empty
};

export const command = "chains";
export const desc = "List information about supported chains";

export const builder: CommandBuilder<{}, Options> = (yargs) => yargs;

const chains = getChains();

export const handler = async (_argv: Arguments<Options>): Promise<void> => {
  console.log(chains);
};
