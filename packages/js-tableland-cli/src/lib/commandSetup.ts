import { helpers, Database, Registry, Validator } from "@tableland/sdk";
import { init } from "@tableland/sqlparser";
import { Signer } from "ethers";
import { GlobalOptions } from "../cli.js";
import { getWalletWithProvider } from "../utils.js";
import EnsResolver from "./EnsResolver.js";

export type ConnectionsOptions = { readOnly: boolean };

export class Connections {
  _database: Database | undefined;
  _validator: Validator | undefined;
  _signer: Signer | undefined;
  _registry: Registry | undefined;
  _ens: EnsResolver | undefined;
  _network: helpers.ChainInfo | undefined;
  _ready: Promise<void>;
  _readyResolved = false;

  ready() {
    return this._ready;
  }

  readyCheck() {
    if (!this._readyResolved)
      throw new Error(
        "You must await the 'ready' method before using this class"
      );
  }

  get ens(): EnsResolver | undefined {
    this.readyCheck();
    return this._ens;
  }

  get registry(): Registry {
    this.readyCheck();
    if (!this._registry) throw new Error("No registry");
    return this._registry;
  }

  get validator(): Validator {
    this.readyCheck();
    if (!this._validator) throw new Error("No registry");
    return this._validator;
  }

  get signer(): Signer {
    this.readyCheck();
    if (!this._signer) {
      throw new Error(
        "To send transactions, you need to specify a privateKey, providerUrl, and chain"
      );
    }
    return this._signer;
  }

  get database(): Database {
    this.readyCheck();
    if (!this._database)
      throw new Error(
        "No database defined. You must specify a providerUrl or chain."
      );
    return this._database;
  }

  get network(): helpers.ChainInfo {
    this.readyCheck();
    if (!this._network) throw new Error("No network");
    return this._network;
  }

  constructor(
    argv: GlobalOptions,
    options: { readOnly: boolean } = { readOnly: false }
  ) {
    this._ready = this.prepare(argv, options).then(() => {
      this._readyResolved = true;
    });
  }

  async prepare(
    argv: GlobalOptions,
    options: { readOnly: boolean } = { readOnly: false }
  ) {
    const {
      privateKey,
      chain,
      providerUrl,
      baseUrl,
      enableEnsExperiment,
      ensProviderUrl,
    } = argv;
    const { readOnly } = options;
    let signer: Signer | undefined;

    if (!options.readOnly) {
      signer = await getWalletWithProvider({
        privateKey,
        providerUrl,
        chain,
      });
      this._signer = signer;
    }

    if (enableEnsExperiment && ensProviderUrl) {
      this._ens = new EnsResolver({
        ensProviderUrl,
        signer,
      });
    }
    try {
      this._network = helpers.getChainInfo(chain);
    } catch (e) {
      console.error("unsupported chain (see `chains` command for details)");
    }

    if (signer) this._registry = new Registry({ signer });

    this._database =
      readOnly && !baseUrl
        ? Database.readOnly(chain)
        : new Database({
            signer,
            baseUrl,
          });

    this._validator =
      baseUrl || !chain
        ? new Validator({ baseUrl })
        : Validator.forChain(chain);
  }
}

export async function setupCommand(
  argv: GlobalOptions,
  options?: ConnectionsOptions
) {
  await init();
  const connections = new Connections(argv, options);
  await connections.ready();
  return connections;
}
