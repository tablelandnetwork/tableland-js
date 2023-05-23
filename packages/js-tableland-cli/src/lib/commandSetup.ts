import { helpers, Database, Registry, Validator } from "@tableland/sdk";
import { init } from "@tableland/sqlparser";
import { Signer } from "ethers";
import { GlobalOptions } from "../cli.js";
import { getWalletWithProvider } from "../utils.js";
import EnsResolver from "./EnsResolver.js";

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
    if (!this._registry)
      throw new Error(
        "No registry. This may be because you did not specify a private key with which to interact with the registry."
      );
    return this._registry;
  }

  get validator(): Validator {
    this.readyCheck();
    if (!this._validator)
      throw new Error("No validator. Set a chain or a baseURL.");
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

  constructor(argv: GlobalOptions) {
    this._ready = this.prepare(argv).then(() => {
      this._readyResolved = true;
    });
  }

  async normalize(statement: string) {
    return await globalThis.sqlparser.normalize(statement);
  }

  // Once a command is issued we want to collect the args and options and
  // "prepare" all of the underlying interfaces, e.g. validator, signer, database, etc...
  // The strategy we are employing here boils down to, "setup everything we can with what we are given"
  // Then the command handler will have everything it needs as long as it is requiring the correct
  // args.
  async prepare(argv: GlobalOptions) {
    const {
      privateKey,
      providerUrl,
      chain,
      baseUrl,
      enableEnsExperiment,
      ensProviderUrl,
    } = argv;

    if (privateKey && chain) {
      this._signer = await getWalletWithProvider({
        privateKey,
        // providerUrl is optional, and this might be undefined
        providerUrl,
        chain,
      });
    }

    if (enableEnsExperiment && ensProviderUrl) {
      this._ens = new EnsResolver({
        ensProviderUrl,
        signer: this._signer,
      });
    }

    if (chain) {
      try {
        this._network = helpers.getChainInfo(chain);
      } catch (e) {
        console.error("unsupported chain (see `chains` command for details)");
      }
    }

    if (this._signer) this._registry = new Registry({ signer: this._signer });

    this._database = new Database({
      // both of these props might be undefined
      signer: this._signer,
      baseUrl,
      autoWait: true,
    });

    if (baseUrl) {
      this._validator = new Validator({ baseUrl });
    } else if (chain) {
      this._validator = Validator.forChain(chain);
    }
  }
}

export async function setupCommand(argv: GlobalOptions) {
  await init();
  const connections = new Connections(argv);
  await connections.ready();
  return connections;
}
