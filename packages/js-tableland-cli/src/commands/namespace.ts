import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { GlobalOptions } from "../cli.js";
import { setupCommand } from "../lib/commandSetup.js";

export interface Options extends GlobalOptions {
  domain: string;
  mappings: string[];
  get: boolean;
  set: boolean;
}

export const command = "namespace <domain> [mappings..]";
export const desc = "Manage ENS names for tables";

export const builder: CommandBuilder<{}, Options> = (yargs) =>
  yargs
    .positional("domain", {
      type: "string",
      description: "The root domain of the namespace",
    })
    .option("set", {
      type: "boolean",
      description: "Set text records for a namespace",
    })
    .option("get", {
      type: "boolean",
      description: "Pass in a record to find it's table name",
    })
    .usage(``) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { domain, mappings, get, set } = argv;
  const { ens } = await setupCommand(argv);
  if (!ens) return;

  if (get) {
    console.log(await ens.resolveTable(domain));
  }

  if (set) {
    const records = mappings.map((entry: any) => {
      const [key, value] = entry.split("=");

      const keyRegex = /^[a-zA-Z0-9_]*$/;
      const valueRegex = /^[a-zA-Z_][a-zA-Z0-9_]*_[0-9]+_[0-9]+$/;

      if (keyRegex.exec(key) === null) {
        throw new Error("Only letters or underscores in key name");
      }
      if (valueRegex.exec(value) === null) {
        throw new Error("Tablename should be a valid tableland table name");
      }
      return {
        key,
        value,
      };
    });

    if (await ens.addTableRecords(domain, records)) {
      const response = {
        domain,
        records,
        mappings,
      };

      console.dir(response, { depth: null });
    }
  }
};
