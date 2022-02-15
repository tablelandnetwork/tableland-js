import yargs, { Arguments, CommandBuilder } from "yargs";
import fetch from "node-fetch";

type Options = {
  // Local
  id: string;

  // Global
  host: string;
};

export const command = "info <id>";
export const desc = "Get info about a given table by id.";

export const builder: CommandBuilder = (yargs) =>
  yargs.positional("id", {
    type: "string",
    description: "The target table id",
  }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { host, id } = argv;
  const res = await fetch(`${host}/tables/${id}`);
  const out = JSON.stringify(await res.json(), null, 2);
  process.stdout.write(`${out}\n`);
  process.exit(0);
};
