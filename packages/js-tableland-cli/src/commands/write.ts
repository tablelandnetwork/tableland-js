import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { connect, ConnectOptions, ChainName } from "@tableland/sdk";
import { getWalletWithProvider, getLink } from "../utils.js";
import { promises } from "fs";
import { createInterface } from "readline";

export type Options = {
  // Local
  statement?: string;
  file?: string;

  // Global
  privateKey: string;
  chain: ChainName;
  providerUrl: string | undefined;
};

export const command = "write [statement]";
export const desc = "Run a mutating SQL statement against a remote table";
export const aliases = ["w", "run", "r"];

export const builder: CommandBuilder<{}, Options> = (yargs) =>
  yargs
    .positional("statement", {
      type: "string",
      description: "Input SQL statement (skip to read from stdin)",
    })
    .option("file", {
      alias: "f",
      description: "Get statement from input file",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  let { statement } = argv;
  const { privateKey, chain, providerUrl, file } = argv;

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
    if (file != null) {
      statement = await promises.readFile(file, { encoding: "utf-8" });
    } else if (statement == null) {
      const rl = createInterface({ input: process.stdin });
      const it = rl[Symbol.asyncIterator]();
      const { value } = await it.next();
      statement = value;
    }
    if (!statement) {
      console.error(
        "missing input value (`statement`, `file`, or piped input from stdin required)"
      );
      return;
    }
    const res = await connect(options).write(statement, {
      skipConfirm: false,
      rpcRelay: false,
    });
    const link = getLink(chain, res.hash);
    const out = JSON.stringify({ ...res, link }, null, 2);
    console.log(out);
    /* c8 ignore next 3 */
  } catch (err: any) {
    console.error(err.message);
  }
};
