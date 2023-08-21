import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { type GlobalOptions } from "../cli.js";
import { setupCommand } from "../lib/commandSetup.js";
import { logger } from "../utils.js";

export interface Options extends GlobalOptions {
  name: string;
}

export const command = "schema <name>";
export const desc = "Get info about a given table schema";

export const builder: CommandBuilder<Record<string, unknown>, Options> = (
  yargs
) =>
  yargs.positional("name", {
    type: "string",
    description: "The target table name",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  try {
    const { name } = argv;
    const [tableId, chainId] = name.split("_").reverse();

    const parts = name.split("_");

    if (parts.length < 3 && argv.enableEnsExperiment == null) {
      logger.error(
        "invalid table name (name format is `{prefix}_{chainId}_{tableId}`)"
      );
      return;
    }

    const { validator } = await setupCommand({
      ...argv,
      chain: parseInt(chainId) as any,
    });

    const res = await validator.getTableById({
      tableId,
      chainId: parseInt(chainId),
    });
    logger.log(JSON.stringify(res.schema));
    /* c8 ignore next 3 */
  } catch (err: any) {
    logger.error(err.message);
  }
};
