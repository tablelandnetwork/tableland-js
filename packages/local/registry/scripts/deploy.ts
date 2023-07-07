import { ethers } from "hardhat";

async function main() {
  console.log("Importing the deploy script");
  await import("@tableland/evm/scripts/deploy.js");
  console.log("Imported the deploy script");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
