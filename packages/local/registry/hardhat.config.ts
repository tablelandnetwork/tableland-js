import { HardhatUserConfig, extendEnvironment } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
import {
  baseURIs,
  proxies,
  TablelandNetworkConfig,
} from "@tableland/evm/network";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      // Matching this to the registry in evm-tableland
      optimizer: {
        enabled: true,
        runs: 9999999,
      },
    },
  },
  networks: {
    // we need automining for the validator event processor to work
    hardhat: {
      mining: {
        auto: !(process.env.HARDHAT_DISABLE_AUTO_MINING === "true"),
        interval: [100, 3000],
      },
      gas: 40 * 1000 * 1000,
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: `http://127.0.0.1:${process.env.HARDHAT_PORT || 8545}`,
    },
  },
  baseURIs,
  proxies,
};

declare module "hardhat/types/runtime" {
  // eslint-disable-next-line no-unused-vars
  interface HardhatRuntimeEnvironment {
    baseURI: string;
  }
}

extendEnvironment((hre: HardhatRuntimeEnvironment) => {
  // Set base URI for local network
  hre.baseURI = "http://localhost:8080/chain/31337/tables/";
});

declare module "hardhat/types/config" {
  // eslint-disable-next-line no-unused-vars
  interface HardhatUserConfig {
    baseURIs: TablelandNetworkConfig;
    proxies: TablelandNetworkConfig;
  }
}

declare module "hardhat/types/runtime" {
  // eslint-disable-next-line no-unused-vars
  interface HardhatRuntimeEnvironment {
    baseURI: string;
    proxy: string;
  }
}

extendEnvironment((hre: HardhatRuntimeEnvironment) => {
  // Get base URI for user-selected network
  const uris = hre.userConfig.baseURIs as any;
  hre.baseURI = uris[hre.network.name];

  // Get proxy address for user-selected network
  const proxies = hre.userConfig.proxies as any;
  hre.proxy = proxies[hre.network.name];
});

export default config;
