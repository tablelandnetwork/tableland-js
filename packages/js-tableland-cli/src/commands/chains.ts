import type { Arguments, CommandBuilder } from "yargs";
import { GlobalOptions } from "../cli.js";
import { getChains } from "../utils.js";
import type yargs from "yargs";

export interface Options extends GlobalOptions {
  format: "pretty" | "json" | "jsonl";
}

export const command = "chains";
export const desc = "List information about supported chains";

export const builder: CommandBuilder<{}, Options> = (yargs) =>
  yargs.option("format", {
    type: "string",
    choices: ["pretty", "json", "jsonl"] as const,
    description: "Output format. One of 'pretty', 'json', or 'jsonl'.",
    default: "json",
  }) as yargs.Argv<Options>;

const chains = getChains();

export const handler = async (_argv: Arguments<Options>): Promise<void> => {
  const { format } = _argv;

  if (format === "pretty") {
    console.log(JSON.stringify(chains, null, 4));
    return;
  }
  if (format === "jsonl") {
    console.log(
      Object.entries(chains)
        .map((chain) => JSON.stringify(chain[1]))
        .join("\n")
    );
    return;
  }
  // default is "json"
  console.log(JSON.stringify(chains));
};
