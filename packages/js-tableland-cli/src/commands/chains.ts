import type { Arguments, CommandBuilder } from "yargs";
import { GlobalOptions } from "../cli.js";
import { getChains } from "../utils.js";
import type yargs from "yargs";

export type Options = GlobalOptions;

export const command = "chains";
export const desc = "List information about supported chains";

export const builder: CommandBuilder<{}, Options> = (yargs) =>
  yargs as yargs.Argv<Options>;

const chains = getChains();

export const handler = async (_argv: Arguments<Options>): Promise<void> => {
  console.dir(chains, { depth: null });
};
