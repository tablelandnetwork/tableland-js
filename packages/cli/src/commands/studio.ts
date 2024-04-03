import type { Arguments, Argv } from "yargs";
import type { GlobalOptions as StudioOptions } from "@tableland/studio-cli";
import { commands as studioCommands } from "@tableland/studio-cli/dist/commands/index.js";
import type { GlobalOptions } from "../cli.js";

export const command = "studio <sub>";
export const desc = "Tableland Studio CLI commands";

export interface Options extends GlobalOptions, StudioOptions {}

export const builder: (yargs: Argv<Record<string, unknown>>) => void =
  function (yargs) {
    for (const cmnd of studioCommands) {
      yargs
        .command(
          cmnd.command,
          cmnd.desc,
          typeof (cmnd as any).builder !== "undefined"
            ? (cmnd as any).builder
            : {},
          cmnd.handler as any
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
