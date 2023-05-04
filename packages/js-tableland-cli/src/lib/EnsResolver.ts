import ethers, { Signer } from "ethers";
import ensLib from "./EnsCommand";
import { JsonRpcProvider } from "@ethersproject/providers";
import { ENS } from "@ensdomains/ensjs";

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
    if (!ensProviderUrl) throw new Error("No ensProviderUrl given");
    this.signer = signer;
    this.provider = new JsonRpcProvider(ensProviderUrl);

    this.ENS = new ensLib.ENS().withProvider(this.provider);
  }

  async resolveTable(tablename: string): Promise<string> {
    const [textRecord, ...domainArray] = tablename.split(".");

    const domain = domainArray.join(".");

    const address = await this.provider.getResolver(domain);

    return (await address?.getText(textRecord)) || tablename;
  }

  async addTableRecords(domain: string, maps: TableMap[]) {
    try {
      await this.ENS.setRecords(domain, {
        records: {
          texts: maps,
        },
        // @ts-ignore
        signer: this.signer,
      });
      return true;
    } catch (e: any) {
      console.log("Adding table to ENS failed");
      console.error(e.message);
    }
    return true;
  }

  async resolve(statement: string): Promise<string> {
    const tableNames: string[] = await globalThis.sqlparser.getUniqueTableNames(
      statement
    );
    const record: any = {};

    const resolvedTablenames = await Promise.all(
      tableNames.map((tableName) => {
        return new Promise((resolve) => {
          (async () => {
            resolve([tableName, await this.resolveTable(tableName)]);
          })();
        });
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
