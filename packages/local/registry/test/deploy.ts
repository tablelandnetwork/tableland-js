import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("deploy", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deploy() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const TablelandTables = await ethers.getContractFactory("TablelandTables");
    const tables = await TablelandTables.deploy();

    return { tables };
  }

  describe("Deployment", function () {
    it("Should return contract address", async function () {
      const { tables } = await loadFixture(deploy);

      expect(typeof tables.address).to.equal("string");
    });
  });
});
