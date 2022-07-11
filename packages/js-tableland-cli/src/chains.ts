import { SUPPORTED_CHAINS } from "@tableland/sdk";

export default function getChains(): any {
  const chains: any = SUPPORTED_CHAINS;
  for (const [name] of Object.entries(chains)) {
    if (name.includes("staging")) {
      delete chains[name];
    } else if (name.includes("custom")) {
      delete chains[name];
    }
  }
  return chains;
}
