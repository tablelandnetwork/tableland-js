import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { helpers } from "@tableland/sdk";
import { type GlobalOptions } from "../cli.js";
import { setupCommand } from "../lib/commandSetup.js";
import { logger } from "../utils.js";

export interface Options extends GlobalOptions {
  hash: string;
}

export const command = "receipt <hash>";
export const desc =
  "Get the receipt of a chain transaction to know if it was executed, and the execution details";

export const builder: CommandBuilder<Record<string, unknown>, Options> = (
  yargs
) =>
  yargs.positional("hash", {
    type: "string",
    description: "Transaction hash",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  try {
    const { hash, chain } = argv;
    if (chain == null) {
      logger.error("missing required flag (`-c` or `--chain`)");
      return;
    }
    const { validator } = await setupCommand(argv);
    const res = await validator.receiptByTransactionHash({
      chainId: helpers.getChainId(chain),
      transactionHash: hash,
    });
    logger.log(JSON.stringify(res));
    /* c8 ignore next 3 */
  } catch (err: any) {
    logger.error(err.message);
  }
};
