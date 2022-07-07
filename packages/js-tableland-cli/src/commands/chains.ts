import type { Arguments, CommandBuilder } from "yargs";
import { SUPPORTED_CHAINS } from "@tableland/sdk";

type Options = {
  // emopty
};

export const command = "chains";
export const desc = "List information about supported chains";

export const builder: CommandBuilder<Options, Options> = (yargs) => yargs;

export const handler = async (_argv: Arguments<Options>): Promise<void> => {
  const chains: any = SUPPORTED_CHAINS;
  for (const [name] of Object.entries(chains)) {
    if (name.includes("staging")) {
      delete chains[name];
    }
  }
  const out = JSON.stringify(chains, null, 2);
  console.log(out);
  process.exit(0);
};
