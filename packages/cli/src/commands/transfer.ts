import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { init } from "@tableland/sqlparser";
import { isAddress } from "ethers";
import { type GlobalOptions } from "../cli.js";
import { setupCommand } from "../lib/commandSetup.js";
import { logger, getTableNameWithAlias } from "../utils.js";

export interface Options extends GlobalOptions {
  name: string;
  receiver: string;
}

export const command = "transfer <name> <receiver>";
export const desc = "Transfer a table to another address";

export const builder: CommandBuilder<Record<string, unknown>, Options> = (
  yargs
) =>
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
    const { receiver, chain } = argv;
    const name = await getTableNameWithAlias(argv.aliases, argv.name);

    const { chainId } = await globalThis.sqlparser.validateTableName(name);
    const isValidReceiver = isAddress(receiver);
    if (!isValidReceiver) {
      logger.error(`invalid address: '${receiver}'`);
      return;
    }

    const { registry } = await setupCommand({
      ...argv,
      /* c8 ignore next 1 */ // can't test because of non-standard chain
      chain: chain != null ? chain : chainId,
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
