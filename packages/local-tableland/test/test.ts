import { connect } from '@tableland/sdk';
import { Wallet, providers } from 'ethers';
import { spawn } from 'child_process';
import { createInterface } from 'readline';


describe("Validator, Chain, and SDK work end to end", function () {
    // NOTE: these tests require the a local Tableland is already running

    test("Create a table that can be read from", async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await connect({
            signer: signer,
            network: 'local',
            host: 'http://localhost:8080'
        });

        const prefix = 'test_create';
        const receipt = await tableland.create(31337, 'key TEXT, val TEXT', prefix);
        // TODO: read table id out of receipt
        const tableId = 0;
        const chainId = 31337;

        const data = await tableland.query(`SELECT * FROM ${prefix}_${chainId}_${tableId};`);
        console.log(data);
        await expect(data.rows).toEqual([]);
    });

});
