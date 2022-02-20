import type { Arguments, CommandBuilder } from "yargs";
import { providers, Wallet } from "ethers";
import { connect } from "@textile/tableland";

type Options = {
  // Global
  privateKey: string;
};

export const command = "jwt";
export const desc = "Create a signed JWT token";

export const builder: CommandBuilder<Options, Options> = (yargs) => yargs;

export const handler = async (argv: Arguments<Options>): Promise<void> => {
  const { privateKey } = argv;
  // FIXME: This is a hack due to js-tableland's restrictive use of provider
  // See: https://github.com/textileio/js-tableland/issues/22
  const signer = new Wallet(privateKey, {
    getNetwork: async () => {
      return {
        name: "rinkeby",
        chainId: 4,
      };
    },
    _isProvider: true,
  } as providers.Provider);
  const { token } = await connect({ signer });

  const out = JSON.stringify(token, null, 2);
  process.stdout.write(`${out}\n`);
  process.exit(0);
};
