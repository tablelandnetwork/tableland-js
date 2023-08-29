import path from "path";
import { HardhatUserConfig, extendEnvironment } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
import {
  baseURIs,
  proxies,
  TablelandNetworkConfig,
} from "@tableland/evm/network";

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  if (args.solcVersion === "0.8.19") {
    const compilerPath = path.join(__dirname, "soljson-v0.8.19.js");

    return {
      compilerPath,
      isSolcJs: true, // if you are using a native compiler, set this to false
      version: args.solcVersion,
      // this is used as extra information in the build-info files, but other than
      // that is not important
      longVersion: "0.8.19-nightly.2023.2.22+commit.7dd6d40",
    };
  }

  // we just use the default subtask if the version is not 0.8.5
  return runSuper();
});

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
