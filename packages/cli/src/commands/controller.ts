import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { Registry } from "@tableland/sdk";
import {
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
          description: "The target table name",
        }) as yargs.Argv<Options>,
      async (argv) => {
        const { name, privateKey, providerUrl } = argv;
        const chain = getChainName(argv.chain);

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
            description: "The target table name",
          }) as yargs.Argv<Options>,
      async (argv) => {
        const { name, controller, privateKey, providerUrl } = argv;
        const chain = getChainName(argv.chain);

        try {
          const signer = await getWalletWithProvider({
            privateKey,
            chain,
            providerUrl,
          });

          const reg = new Registry({ signer });
          const res = await reg.setController({ tableName: name, controller });

          const link = getLink(chain, res.hash);
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
          description: "The target table name",
        }) as yargs.Argv<Options>,
      async (argv) => {
        const { name, privateKey, providerUrl } = argv;
        const chain = getChainName(argv.chain);

        try {
          const signer = await getWalletWithProvider({
            privateKey,
            chain,
            providerUrl,
          });

          const reg = new Registry({ signer });

          const res = await reg.lockController(name);

          const link = getLink(chain, res.hash);
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
