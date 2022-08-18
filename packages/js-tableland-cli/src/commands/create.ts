import type yargs from "yargs";
import type { Arguments, CommandBuilder } from "yargs";
import { connect, ConnectOptions, ChainName } from "@tableland/sdk";
import { getWallet, getLink } from "../utils";

type Options = {
  // Local
  schema: string;
  prefix: string | undefined;

  // Global
  rpcRelay: boolean;
  privateKey: string;
  chain: ChainName;
  alchemy: string | undefined;
  infura: string | undefined;
  etherscan: string | undefined;
};

export const command = "create <schema> [prefix]";
export const desc = "Create a new table";

export const builder: CommandBuilder<Options, Options> = (yargs) =>
  yargs
    .positional("schema", {
      type: "string",
      description: "SQL table schema",
    })
    .option("prefix", {
      type: "string",
      description: "Table name prefix",
    }) as yargs.Argv<Options>;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const {
    schema,
    prefix,
    privateKey,
    chain,
    alchemy,
    infura,
    etherscan,
    rpcRelay,
  } = argv;

  try {
    const signer = getWallet({ privateKey, chain, infura, etherscan, alchemy });
    const options: ConnectOptions = {
      chain,
      signer,
    };
    if (typeof rpcRelay === "boolean") options.rpcRelay = rpcRelay;
    const res = await connect(options).create(schema, { prefix });
    const link = getLink(chain, res.txnHash);
    const out = JSON.stringify(
      { ...res, link, tableId: (res.tableId ?? "").toString() },
      null,
      2
    );
    console.log(out);
    process.exit(0);
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
};
