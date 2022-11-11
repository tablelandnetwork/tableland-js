import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { connect, ConnectOptions, ChainName } from "@tableland/sdk";
import { getWalletWithProvider, getLink } from "../utils.js";

export type Options = {
  // Local
  name: string;
  controller: string;

  // Global
  privateKey: string;
  chain: ChainName;
  providerUrl: string | undefined;
};

export const command = "controller <sub>";
export const desc =
  "Get, set, and lock the controller contract for a given table";

export const builder: CommandBuilder<{}, Options> = (yargs) =>
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
        const { name, chain, privateKey, providerUrl } = argv;

        try {
          const signer = getWalletWithProvider({
            privateKey,
            chain,
            providerUrl,
          });
          const options: ConnectOptions = {
            chain,
            signer,
            rpcRelay: false,
          };
          const res = await connect(options).getController(name);
          const out = JSON.stringify(res, null, 2);
          console.log(out);
          /* c8 ignore next 3 */
        } catch (err: any) {
          console.error(err.message);
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
        const { name, controller, chain, privateKey, providerUrl } = argv;

        try {
          const signer = getWalletWithProvider({
            privateKey,
            chain,
            providerUrl,
          });
          const options: ConnectOptions = {
            chain,
            signer,
            rpcRelay: false,
          };
          const res = await connect(options).setController(controller, name, {
            rpcRelay: false,
          });
          const link = getLink(chain, res.hash);
          const out = JSON.stringify({ ...res, link }, null, 2);
          console.log(out);
          /* c8 ignore next 3 */
        } catch (err: any) {
          console.error(err.message);
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
        const { name, chain, privateKey, providerUrl } = argv;

        try {
          const signer = getWalletWithProvider({
            privateKey,
            chain,
            providerUrl,
          });
          const options: ConnectOptions = {
            chain,
            signer,
          };
          const res = await connect(options).lockController(name);
          const link = getLink(chain, res.hash);
          const out = JSON.stringify({ ...res, link }, null, 2);
          console.log(out);
          /* c8 ignore next 3 */
        } catch (err: any) {
          console.error(err.message);
        }
      }
    );

/* c8 ignore next 3 */
export const handler = async (argv: Arguments<Options>): Promise<void> => {
  // noop
};
