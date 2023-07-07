import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { GlobalOptions } from "../cli.js";
import { setupCommand } from "../lib/commandSetup.js";
import { init } from "@tableland/sqlparser";
import { logger } from "../utils.js";

export interface Options extends GlobalOptions {
  name: string;
  receiver: string;
}

export const command = "transfer <name> <receiver>";
export const desc = "Transfer a table to another address";

export const builder: CommandBuilder<{}, Options> = (yargs) =>
  yargs
    .positional("name", {
      type: "string",
      description: "The target table name",
    })
    .positional("receiver", {
      type: "string",
      description: "The address to transfer the table to",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  try {
    await init();
    const { name, receiver, chain } = argv;
    const tableDetails = await globalThis.sqlparser.validateTableName(name);
    const chainId = tableDetails.chainId;

    const { registry } = await setupCommand({
      ...argv,
      chain: chain || chainId,
    });

    const res = await registry.safeTransferFrom({
      tableName: name,
      to: receiver,
    });
    logger.log(JSON.stringify(res));
    /* c8 ignore next 3 */
  } catch (err: any) {
    logger.error(err.message);
  }
};
