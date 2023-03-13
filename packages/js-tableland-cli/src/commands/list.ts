import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { Wallet } from "ethers";
import { GlobalOptions } from "../cli.js";
import { setupCommand } from "../lib/commandSetup.js";

export interface Options extends GlobalOptions {
  address: string;
}

export const command = "list [address]";
export const desc = "List tables by address";

export const builder: CommandBuilder<{}, Options> = (yargs) => {
  return yargs.positional("address", {
    type: "string",
    description: "The target address",
  }) as yargs.Argv<Options>;
};

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  try {
    const { chain, privateKey } = argv;
    let { address } = argv;
    if (!chain) {
      console.error("missing required flag (`-c` or `--chain`)");
      return;
    }
    if (!address) {
      if (privateKey) {
        address = new Wallet(privateKey).address;
      } else {
        console.error("must supply `--privateKey` or `address` positional");
        return;
      }
    }

    const { registry } = await setupCommand(argv);

    const res = await registry.listTables(address);

    console.log(JSON.stringify(res));
    /* c8 ignore next 3 */
  } catch (err: any) {
    console.error(err.message);
  }
};
