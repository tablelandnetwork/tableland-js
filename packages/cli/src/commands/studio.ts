import type { Arguments, Argv, CommandBuilder } from "yargs";
import type { GlobalOptions as StudioOptions } from "@tableland/studio-cli";
import { commands as studioCommands } from "@tableland/studio-cli/dist/commands/index.js";
import type { GlobalOptions } from "../cli.js";

export const command = "studio <sub>";
export const desc = "Tableland Studio CLI commands";

export interface Options extends GlobalOptions, StudioOptions {}

export const builder: (yargs: Argv<Record<string, unknown>>) => void =
  function (yargs) {
    for (const command in studioCommands) {
      yargs
        .command(
          studioCommands[command].command,
          studioCommands[command].desc,
          // @ts-ignore TODO: Everything works at runtime, but I can't figure out why the types don't work here.
          studioCommands[command].builder,
          studioCommands[command].handler
        )
        .option("store", {
          type: "string",
          default: ".studioclisession.json",
          description: "path to file store to use for login session",
        });
    }
  };

/* c8 ignore next 3 */
export const handler = async (argv: Arguments<Options>): Promise<void> => {
  // noop
};
