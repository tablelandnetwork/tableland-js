import { connect } from '@tableland/sdk';
import { Wallet, providers } from 'ethers';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { jest } from '@jest/globals';

// These tests take a bit longer than normal since we are usually waiting for blocks to finalize etc...
jest.setTimeout(20000);

const getTableId = async function (tableland, txnHash, tries = 5) {
    const table = await waitForTx(tableland, txnHash, tries);

    await expect(table).toBeDefined();
    await expect(typeof table.tableId).toEqual('string');

    return table.tableId;
};

const waitForTx = async function (tableland, txnHash, tries = 5) {
    let table = await tableland.receipt(txnHash);
    let tryy = 0
    while (!table && tryy < tries) {
        await new Promise(resolve => setTimeout(resolve, 1500 + (tries * 500)));
        table = await tableland.receipt(txnHash);
        tryy++;
    }

    if (!table) throw new Error(`could not get transaction receipt: ${txnHash}`);

    return table;
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
        const receipt = await tableland.create('key TEXT, val TEXT', prefix);

        const tableId = await getTableId(tableland, receipt.transactionHash);
        const chainId = 31337;

        const data = await tableland.read(`SELECT * FROM ${prefix}_${chainId}_${tableId};`);
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
        const receipt = await tableland.create('key TEXT, val TEXT', prefix);

        const tableId = await getTableId(tableland, receipt.transactionHash);
        const chainId = 31337;
        const queryableName = `${prefix}_${chainId}_${tableId}`;

        const writeRes = await tableland.write(`INSERT INTO ${queryableName} (key, val) VALUES ('tree', 'aspen')`);

        expect(typeof writeRes.hash).toEqual('string');
        await waitForTx(tableland, writeRes.hash);

        const data = await tableland.read(`SELECT * FROM ${queryableName};`);
        await expect(data.rows).toEqual([['tree', 'aspen']]);
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
        const receipt = await tableland.create('key TEXT, val TEXT', prefix);

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

        expect(typeof writeRes.hash).toEqual('string');
        await waitForTx(tableland, writeRes.hash);

        const data2 = await tableland2.read(`SELECT * FROM ${queryableName};`);

        await expect(data.rows).toEqual([]);
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
        const receipt = await tableland.create('key TEXT, val TEXT', prefix);

        const tableId = await getTableId(tableland, receipt.transactionHash);
        const chainId = 31337;
        const queryableName = `${prefix}_${chainId}_${tableId}`;

        const write1 = await tableland.write(`INSERT INTO ${queryableName} (key, val) VALUES ('tree', 'aspen')`);

        expect(typeof write1.hash).toEqual('string');
        await waitForTx(tableland, write1.hash);

        const write2 = await tableland.write(`INSERT INTO ${queryableName} (key, val) VALUES ('tree', 'pine')`);

        expect(typeof write2.hash).toEqual('string');
        await waitForTx(tableland, write2.hash);

        const data = await tableland.read(`SELECT * FROM ${queryableName};`);
        await expect(data.rows.length).toEqual(2);

        const delete1 = await tableland.write(`DELETE FROM ${queryableName} WHERE val = 'pine';`);

        expect(typeof delete1.hash).toEqual('string');
        await waitForTx(tableland, delete1.hash);

        const data2 = await tableland.read(`SELECT * FROM ${queryableName};`);
        await expect(data2.rows.length).toEqual(1);
    }, 30000);

    test("List an account's tables", async function () {
        const wallet = new Wallet('0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82' /* Hardhat #11 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await connect({
            signer: signer,
            network: 'local',
            host: 'http://localhost:8080'
        });

        const prefix = 'test_create_list';
        const receipt = await tableland.create('key TEXT, val TEXT', prefix);

        const tableId = await getTableId(tableland, receipt.transactionHash, 7);
        const chainId = 31337;
        const queryableName = `${prefix}_${chainId}_${tableId}`;

        const tablesMeta = await tableland.list();

        const table = tablesMeta.find(table => table.name === queryableName);

        expect(table).toBeDefined();
        expect(table.controller).toEqual('0x71bE63f3384f5fb98995898A86B02Fb2426c5788' /* account 11 pubkey */ );
    });

});
