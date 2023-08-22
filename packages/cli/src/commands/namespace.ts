import type yargs from "yargs";
import { type Arguments, type CommandBuilder } from "yargs";
import { type GlobalOptions } from "../cli.js";
import { setupCommand } from "../lib/commandSetup.js";
import { logger } from "../utils.js";

export interface Options extends GlobalOptions {
  domain: string;
  mappings: string[];
  record: string;
}

export const command = "namespace <domain> [mappings..]";
export const desc = "Manage ENS names for tables";

async function getHandler(
  argv: yargs.ArgumentsCamelCase<Options>
): Promise<void> {
  const { record } = argv;
  const { ens } = await setupCommand(argv);
  if (ens == null) {
    logger.log(
      "To use ENS, ensure you have set the enableEnsExperiment flag to true"
    );
    return;
  }

  logger.log(JSON.stringify({ value: await ens.resolveTable(record) }));
}

async function setHandler(
  argv: yargs.ArgumentsCamelCase<Options>
): Promise<void> {
  try {
    const { domain, mappings } = argv;
    const { ens } = await setupCommand(argv);
    if (ens == null) {
      logger.log(
        "To use ENS, ensure you have set the enableEnsExperiment flag to true"
      );
      return;
    }

    const records = mappings.map((entry: any) => {
      const [key, value] = entry.split("=");

      const keyRegex = /^[a-zA-Z0-9_]*$/;
      const valueRegex = /^[a-zA-Z_][a-zA-Z0-9_]*_[0-9]+_[0-9]+$/;

      if (keyRegex.exec(key) === null) {
        throw new Error("only letters or underscores in key name");
      }
      if (valueRegex.exec(value) === null) {
        throw new Error("table name is invalid");
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

      logger.log(JSON.stringify(response));
    }
    /* c8 ignore next 7 */
  } catch (err: any) {
    logger.error(
      typeof err?.cause?.message === "string"
        ? err?.cause?.message
        : err?.message
    );
  }
}

export const builder: CommandBuilder<Record<string, unknown>, Options> = (
  yargs
) =>
  yargs
    .command(
      "get <record>",
      "Pass in a record to find its table name",
      (yargs) =>
        yargs.positional("record", {
          type: "string",
          description: "The mapped ENS record",
        }) as yargs.Argv<Options>,
      getHandler
    )
    .command(
      "set <domain> [mappings..]",
      "Set text records for a namespace",
      (yargs) =>
        yargs
          .positional("domain", {
            type: "string",
            description: "The ENS domain to which you are adding a record",
          })
          .positional("mappings", {}) as yargs.Argv<Options>,
      setHandler
    )
    .usage(``);

/* c8 ignore next */
export const handler = async (argv: Arguments<Options>): Promise<void> => {};
