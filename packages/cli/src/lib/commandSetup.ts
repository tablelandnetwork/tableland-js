import { helpers, Database, Registry, Validator } from "@tableland/sdk";
import { init } from "@tableland/sqlparser";
import { jsonFileAliases } from "@tableland/node-helpers";
import { type Signer } from "ethers";
import { type GlobalOptions } from "../cli.js";
import { getWalletWithProvider, logger } from "../utils.js";

export class Connections {
  _database: Database | undefined;
  _validator: Validator | undefined;
  _signer: Signer | undefined;
  _registry: Registry | undefined;
  _network: helpers.ChainInfo | undefined;
  _ready: Promise<void>;
  _readyResolved = false;

  async ready(): Promise<void> {
    return await this._ready;
  }

  readyCheck(): void {
    if (!this._readyResolved)
      /* c8 ignore next 3 */
      throw new Error(
        "You must await the 'ready' method before using this class"
      );
  }

  get registry(): Registry {
    this.readyCheck();
    if (this._registry == null)
      throw new Error(
        "No registry. This may be because you did not specify a private key with which to interact with the registry."
      );
    return this._registry;
  }

  get validator(): Validator {
    this.readyCheck();
    /* c8 ignore next 3 */
    if (this._validator == null) {
      throw new Error("No validator. Set a chain or a baseURL.");
    }
    return this._validator;
  }

  get signer(): Signer {
    this.readyCheck();
    if (this._signer == null) {
      throw new Error(
        "To send transactions, you need to specify a privateKey, providerUrl, and chain"
      );
    }
    return this._signer;
  }

  get database(): Database {
    this.readyCheck();
    /* c8 ignore next 5 */
    if (this._database == null) {
      throw new Error(
        "No database defined. You must specify a providerUrl or chain."
      );
    }
    return this._database;
  }

  get network(): helpers.ChainInfo {
    this.readyCheck();
    /* c8 ignore next 1 */
    if (this._network == null) throw new Error("No network");
    return this._network;
  }

  constructor(argv: GlobalOptions) {
    this._ready = this.prepare(argv).then(() => {
      this._readyResolved = true;
    });
  }

  async normalize(statement: string): Promise<unknown> {
    return await globalThis.sqlparser.normalize(statement);
  }

  // Once a command is issued we want to collect the args and options and
  // "prepare" all of the underlying interfaces, e.g. validator, signer, database, etc...
  // The strategy we are employing here boils down to, "setup everything we can with what we are given"
  // Then the command handler will have everything it needs as long as it is requiring the correct
  // args.
  async prepare(argv: GlobalOptions): Promise<void> {
    const { privateKey, providerUrl, chain, baseUrl, aliases } = argv;

    if (privateKey != null && chain != null) {
      this._signer = await getWalletWithProvider({
        privateKey,
        // providerUrl is optional, and this might be undefined
        providerUrl,
        chain,
      });
    }

    if (chain != null) {
      try {
        this._network = helpers.getChainInfo(chain);
      } catch (e) {
        logger.error("unsupported chain (see `chains` command for details)");
      }
    }

    if (this._signer != null)
      this._registry = new Registry({ signer: this._signer });

    let aliasesNameMap;
    if (aliases != null) {
      aliasesNameMap = jsonFileAliases(aliases);
    }

    this._database = new Database({
      // signer, baseURL, and aliases might be undefined
      signer: this._signer,
      baseUrl,
      autoWait: true,
      aliases: aliasesNameMap,
    });

    if (typeof baseUrl === "string" && baseUrl.trim() !== "") {
      this._validator = new Validator({ baseUrl });
    } else if (chain != null) {
      this._validator = Validator.forChain(chain);
    }
  }
}

export async function setupCommand(argv: GlobalOptions): Promise<Connections> {
  await init();
  const connections = new Connections(argv);
  await connections.ready();
  return connections;
}
