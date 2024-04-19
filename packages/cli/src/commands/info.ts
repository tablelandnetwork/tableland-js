import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { init } from "@tableland/sqlparser";
import { type GlobalOptions } from "../cli.js";
import { setupCommand } from "../lib/commandSetup.js";
import { getTableNameWithAlias, logger } from "../utils.js";

export interface Options extends GlobalOptions {
  name: string;
}

export const command = "info <name>";
export const desc = "Get info about a given table by name";

export const builder: CommandBuilder<Record<string, unknown>, Options> = (
  yargs
) =>
  yargs.positional("name", {
    type: "string",
    description: "The target table name",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  await init();
  try {
    const name = await getTableNameWithAlias(argv.aliases, argv.name);

    const { tableId, chainId } = await globalThis.sqlparser.validateTableName(
      name
    );
    const { validator } = await setupCommand({
      ...argv,
      chain: chainId,
    });

    // Get the table ID, now that the name comes from either an alias or
    // the standard naming convention
    const res = await validator.getTableById({
      tableId: tableId.toString(),
      chainId,
    });
    logger.log(JSON.stringify(res));
    /* c8 ignore next 7 */
  } catch (err: any) {
    if (err.message.match(/table name has wrong format/)) {
      logger.error(
        "invalid table name (name format is `{prefix}_{chainId}_{tableId}`)"
      );
    } else {
      logger.error(
        typeof err?.cause?.message === "string"
          ? err?.cause?.message
          : err.message
      );
    }
  }
};
