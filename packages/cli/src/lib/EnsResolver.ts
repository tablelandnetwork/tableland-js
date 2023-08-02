import { type Signer } from "ethers";
import type ethers from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { type ENS } from "@ensdomains/ensjs";
import { logger } from "../utils.js";
import ensLib from "./EnsCommand.js";

interface EnsResolverOptions {
  ensProviderUrl: string;
  signer?: Signer;
}

interface TableMap {
  key: string;
  value: string;
}

export default class EnsResolver {
  provider: ethers.providers.JsonRpcProvider;
  signer: Signer | undefined;
  ENS: ENS;

  constructor(options: EnsResolverOptions) {
    const { signer, ensProviderUrl } = options;
    /* c8 ignore next 3 */
    if (ensProviderUrl == null) {
      throw new Error("No ensProviderUrl given");
    }
    this.signer = signer;
    this.provider = new JsonRpcProvider(ensProviderUrl);

    this.ENS = new ensLib.ENS().withProvider(this.provider);
  }

  async resolveTable(tablename: string): Promise<string> {
    // strip the [] sql identifier escape characters at the start and
    // end, if they exist, then split on the "." separator
    const [textRecord, ...domainArray] =
      removeEscapeChars(tablename).split(".");

    const domain = domainArray.join(".");
    const address = await this.provider.getResolver(domain);

    return (await address?.getText(textRecord)) ?? tablename;
  }

  async addTableRecords(domain: string, maps: TableMap[]): Promise<boolean> {
    try {
      await this.ENS.setRecords(domain, {
        records: {
          texts: maps,
        },
        // @ts-expect-error TODO: this needs a description for linting
        signer: this.signer,
      });
      return true;
    } catch (e: any) {
      logger.log("Adding table to ENS failed");
      logger.error(e.message);
    }
    return true;
  }

  async resolve(statement: string): Promise<string> {
    const tableNames: string[] = await globalThis.sqlparser.getUniqueTableNames(
      statement
    );
    const record: any = {};

    const resolvedTablenames = await Promise.all(
      tableNames.map(async (tableName) => {
        tableName = removeEscapeChars(tableName);
        return [tableName, await this.resolveTable(tableName)];
      })
    );

    resolvedTablenames.forEach((table: any) => {
      record[table[0]] = table[1];
    });

    const statements = await globalThis.sqlparser.normalize(statement, record);
    const finalStatement = statements.statements.join(";");

    return finalStatement;
  }
}

function removeEscapeChars(tableName: string): string {
  return tableName
    .trim()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/^`/, "")
    .replace(/`$/, "")
    .replace(/^"/, "")
    .replace(/"$/, "");
}
