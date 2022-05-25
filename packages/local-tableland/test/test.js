import { connect } from '@tableland/sdk';
import { Wallet, providers } from 'ethers';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { jest } from '@jest/globals';

// These tests take a bit longer than normal since we are usually waiting for blocks to finalize etc...
jest.setTimeout(20000);

const getTableId = async function (tableland, txnHash) {
    let table = await tableland.receipt(txnHash);
    let tries = 0
    while (!table && tries < 5) {
        await new Promise(resolve => setTimeout(resolve, 1500 + (tries * 500)));
        table = await tableland.receipt(txnHash);
        tries++;
    }

    await expect(table).toBeDefined();
    await expect(typeof table.tableId).toEqual('string');

    return table.tableId;
};

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

        const prefix = 'test_create_read';
        const receipt = await tableland.create(31337, 'key TEXT, val TEXT', prefix);

        const tableId = await getTableId(tableland, receipt.transactionHash);
        const chainId = 31337;

        const data = await tableland.read(`SELECT * FROM ${prefix}_${chainId}_${tableId};`);
        await expect(data.rows).toEqual([]);
    });

    test("Table cannot be written to unless caller is allowed", async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await connect({
            signer: signer,
            network: 'local',
            host: 'http://localhost:8080'
        });

        const prefix = 'test_not_allowed';
        const receipt = await tableland.create(31337, 'key TEXT, val TEXT', prefix);

        const tableId = await getTableId(tableland, receipt.transactionHash);
        const chainId = 31337;
        const queryableName = `${prefix}_${chainId}_${tableId}`;

        const data = await tableland.read(`SELECT * FROM ${queryableName};`);
        await expect(data.rows).toEqual([]);

        const wallet2 = new Wallet('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' /* Hardhat #2 */);
        const provider2 = new providers.JsonRpcProvider('http://localhost:8545');
        const signer2 = wallet2.connect(provider2);

        const tableland2 = await connect({
            signer: signer2,
            network: 'local',
            host: 'http://localhost:8080'
        });

        const writeRes = await tableland2.write(`INSERT INTO ${queryableName} (key, val) VALUES ('tree', 'aspen')`);

        await new Promise(resolve => setTimeout(resolve, 4000));

        const data2 = await tableland2.read(`SELECT * FROM ${queryableName};`);
        console.log(data);
        await expect(data.rows).toEqual([]);
    });

    test("Create a table that can be written to", async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await connect({
            signer: signer,
            network: 'local',
            host: 'http://localhost:8080'
        });

        const prefix = 'test_create_write';
        const receipt = await tableland.create(31337, 'key TEXT, val TEXT', prefix);

        const tableId = await getTableId(tableland, receipt.transactionHash);
        const chainId = 31337;
        const queryableName = `${prefix}_${chainId}_${tableId}`;

        const writeRes = await tableland.write(`INSERT INTO ${queryableName} (key, val) VALUES ('tree', 'aspen')`);

        await new Promise(resolve => setTimeout(resolve, 4000));

        const data = await tableland.read(`SELECT * FROM ${queryableName};`);
        await expect(data.rows).toEqual([['tree', 'aspen']]);
    });

    test("Create a table can have a row deleted", async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await connect({
            signer: signer,
            network: 'local',
            host: 'http://localhost:8080'
        });

        const prefix = 'test_create_delete';
        const receipt = await tableland.create(31337, 'key TEXT, val TEXT', prefix);

        const tableId = await getTableId(tableland, receipt.transactionHash);
        const chainId = 31337;
        const queryableName = `${prefix}_${chainId}_${tableId}`;

        await tableland.write(`INSERT INTO ${queryableName} (key, val) VALUES ('tree', 'aspen')`);
        await tableland.write(`INSERT INTO ${queryableName} (key, val) VALUES ('tree', 'pine')`);

        await new Promise(resolve => setTimeout(resolve, 6000));

        const data = await tableland.read(`SELECT * FROM ${queryableName};`);
        await expect(data.rows.length).toEqual(2);

        await tableland.write(`DELETE FROM ${queryableName} WHERE val = 'pine';`);

        await new Promise(resolve => setTimeout(resolve, 4000));

        const data2 = await tableland.read(`SELECT * FROM ${queryableName};`);
        await expect(data2.rows.length).toEqual(1);
    });

});
