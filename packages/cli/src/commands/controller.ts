import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { Registry, helpers } from "@tableland/sdk";
import { init } from "@tableland/sqlparser";
import {
  getTableNameWithAlias,
  getWalletWithProvider,
  getLink,
  logger,
  getChainName,
} from "../utils.js";
import { type GlobalOptions } from "../cli.js";

export interface Options extends GlobalOptions {
  name: string;
  controller: string;
}

export const command = "controller <sub>";
export const desc =
  "Get, set, and lock the controller contract for a given table";

export const builder: CommandBuilder<Record<string, unknown>, Options> = (
  yargs
) =>
  yargs
    .command(
      "get <name>",
      "Get the current controller address for a table",
      (yargs) =>
        yargs.positional("name", {
          type: "string",
          description: "The target table name (or alias, if enabled)",
        }) as yargs.Argv<Options>,
      async (argv) => {
        await init();
        const { privateKey, providerUrl } = argv;
        const chain = getChainName(argv.chain);
        const name = await getTableNameWithAlias(argv.aliases, argv.name);

        try {
          const signer = await getWalletWithProvider({
            privateKey,
            chain,
            providerUrl,
          });

          const reg = new Registry({ signer });
          const res = await reg.getController(name);

          logger.log(res);
          /* c8 ignore next 3 */
        } catch (err: any) {
          logger.error(err.message);
        }
      }
    )
    .command(
      "set <controller> <name>",
      "Set the controller address for a table",
      (yargs) =>
        yargs
          .positional("controller", {
            type: "string",
            description: "The target controller address",
          })
          .positional("name", {
            type: "string",
            description: "The target table name (or alias, if enabled)",
          }) as yargs.Argv<Options>,
      async (argv) => {
        await init();
        const { controller, privateKey, providerUrl } = argv;
        const chain = getChainName(argv.chain);
        const name = await getTableNameWithAlias(argv.aliases, argv.name);

        try {
          const signer = await getWalletWithProvider({
            privateKey,
            chain,
            providerUrl,
          });

          const reg = new Registry({ signer });
          const tx = await reg.setController({ tableName: name, controller });
          const res = await helpers.getContractReceipt(tx);

          const link = getLink(chain, tx.hash);
          const out = { ...res, link };
          logger.log(JSON.stringify(out));
          /* c8 ignore next 3 */
        } catch (err: any) {
          logger.error(err.message);
        }
      }
    )
    .command(
      "lock <name>",
      "Lock the controller address for a table",
      (yargs) =>
        yargs.positional("name", {
          type: "string",
          description: "The target table name (or alias, if enabled)",
        }) as yargs.Argv<Options>,
      async (argv) => {
        await init();
        const { privateKey, providerUrl } = argv;
        const chain = getChainName(argv.chain);
        const name = await getTableNameWithAlias(argv.aliases, argv.name);

        try {
          const signer = await getWalletWithProvider({
            privateKey,
            chain,
            providerUrl,
          });

          const reg = new Registry({ signer });
          const tx = await reg.lockController(name);
          const res = await helpers.getContractReceipt(tx);

          const link = getLink(chain, tx.hash);
          const out = { ...res, link };
          logger.log(JSON.stringify(out));
          /* c8 ignore next 3 */
        } catch (err: any) {
          logger.error(err.message);
        }
      }
    );

/* c8 ignore next 3 */
export const handler = async (argv: Arguments<Options>): Promise<void> => {
  // noop
};
