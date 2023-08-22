import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { init } from "@tableland/sqlparser";
import { type GlobalOptions } from "../cli.js";
import { setupCommand } from "../lib/commandSetup.js";
import { logger, getTableNameWithAlias } from "../utils.js";

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
    await init();
    let { name } = argv;

    // Check if the passed `name` is a table alias
    if (argv.aliases != null)
      name = await getTableNameWithAlias(argv.aliases, name);
    // Check if the passed `name` uses ENS
    // Note: duplicative `setupCommand` calls will occur with ENS, but this is
    // required to properly parse the chainId from the table name
    if (argv.enableEnsExperiment != null && argv.ensProviderUrl != null) {
      const { ens } = await setupCommand({
        ...argv,
      });
      if (ens != null) name = await ens.resolveTable(name);
    }

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
      tableId: tableId.toString(),
      chainId: parseInt(chainId),
    });
    logger.log(JSON.stringify(res.schema));
    /* c8 ignore next 3 */
  } catch (err: any) {
    logger.error(err.message);
  }
};
