import yargs, { Arguments, CommandBuilder } from "yargs";
import { Wallet } from "ethers";
import fetch from "node-fetch";

type Options = {
  // Local
  controller: string;

  // Global
  privateKey: string;
  host: string;
};

export const command = "list [controller]";
export const desc = "List tables by controller";

export const builder: CommandBuilder<Options, Options> = (yargs) => {
  return yargs.positional("controller", {
    type: "string",
    description: "The target controller address",
  }) as yargs.Argv<Options>;
};

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { privateKey, host } = argv;
  let { controller } = argv;
  if (privateKey && !controller) {
    controller = new Wallet(privateKey).address;
  }
  const res = await fetch(`${host}/tables/controller/${controller}`);
  const out = JSON.stringify(await res.json(), null, 2);
  process.stdout.write(`${out}\n`);
  process.exit(0);
};
