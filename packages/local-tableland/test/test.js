import { Wallet, providers } from 'ethers';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { jest } from '@jest/globals';
import path from 'path';
import {
    HOST,
    testRpcResponse,
    testHttpResponse,
    testSameTypes,
    getTableland,
    getSafe,
    renderPath,
    loadSpecTestData
} from './utils';

const __dirname = path.resolve(path.dirname(''));

// These tests take a bit longer than normal since we are usually waiting for blocks to finalize etc...
jest.setTimeout(25000);

describe('Validator, Chain, and SDK work end to end', function () {
    // NOTE: these tests require the a local Tableland is already running

    test('Create a table that can be read from', async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await getTableland(signer);

        const prefix = 'test_create_read';
        // `key` is a reserved word in sqlite
        const { tableId } = await tableland.create('keyy TEXT, val TEXT', { prefix });

        const chainId = 31337;

        const data = await tableland.read(`SELECT * FROM ${prefix}_${chainId}_${tableId};`);
        await expect(data.rows).toEqual([]);
    });

    test('Create a table that can be written to', async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await getTableland(signer);

        const prefix = 'test_create_write';
        const { tableId } = await tableland.create('keyy TEXT, val TEXT', { prefix });

        const chainId = 31337;
        const queryableName = `${prefix}_${chainId}_${tableId}`;

        const writeRes = await tableland.write(`INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`);

        const data = await tableland.read(`SELECT * FROM ${queryableName};`);

        await expect(typeof writeRes.hash).toEqual('string');
        await expect(data.rows).toEqual([['tree', 'aspen']]);
    });

    test('Table cannot be written to unless caller is allowed', async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await getTableland(signer);

        const prefix = 'test_not_allowed';
        const { tableId } = await tableland.create('keyy TEXT, val TEXT', { prefix });

        const chainId = 31337;
        const queryableName = `${prefix}_${chainId}_${tableId}`;

        const data = await tableland.read(`SELECT * FROM ${queryableName};`);
        await expect(data.rows).toEqual([]);

        const wallet2 = new Wallet('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' /* Hardhat #2 */);
        const provider2 = new providers.JsonRpcProvider('http://localhost:8545');
        const signer2 = wallet2.connect(provider2);

        const tableland2 = await getTableland(signer2);

        const writeRes = await tableland2.write(`INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`);

        const data2 = await tableland2.read(`SELECT * FROM ${queryableName};`);

        await expect(typeof writeRes.hash).toEqual('string');
        await expect(data.rows).toEqual([]);
    });

    test('Create a table can have a row deleted', async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await getTableland(signer);

        const prefix = 'test_create_delete';
        const { tableId } = await tableland.create('keyy TEXT, val TEXT', { prefix });

        const chainId = 31337;
        const queryableName = `${prefix}_${chainId}_${tableId}`;

        const write1 = await tableland.write(`INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`);

        expect(typeof write1.hash).toEqual('string');

        const write2 = await tableland.write(`INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'pine')`);

        expect(typeof write2.hash).toEqual('string');

        const data = await tableland.read(`SELECT * FROM ${queryableName};`);
        await expect(data.rows.length).toEqual(2);

        const delete1 = await tableland.write(`DELETE FROM ${queryableName} WHERE val = 'pine';`);

        expect(typeof delete1.hash).toEqual('string');

        const data2 = await tableland.read(`SELECT * FROM ${queryableName};`);
        await expect(data2.rows.length).toEqual(1);
    }, 30000);

    test('List an account\'s tables', async function () {
        const wallet = new Wallet('0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82' /* Hardhat #11 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await getTableland(signer);

        const prefix = 'test_create_list';
        const { tableId } = await tableland.create('keyy TEXT, val TEXT', { prefix });

        const chainId = 31337;
        const queryableName = `${prefix}_${chainId}_${tableId}`;

        const tablesMeta = await tableland.list();

        await expect(Array.isArray(tablesMeta)).toEqual(true);
        const table = tablesMeta.find(table => table.name === queryableName);

        await expect(table).toBeDefined();
        await expect(table.controller).toEqual('0x71bE63f3384f5fb98995898A86B02Fb2426c5788' /* account 11 pubkey */ );
    });

    test('write to a table without using the relay', async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await getTableland(signer, {rpcRelay: false});

        const prefix = 'test_direct_write';
        const { tableId } = await tableland.create('keyy TEXT, val TEXT', { prefix });

        const chainId = 31337;
        const queryableName = `${prefix}_${chainId}_${tableId}`;

        const writeRes = await tableland.write(`INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`);

        expect(typeof writeRes.hash).toEqual('string');

        const data = await tableland.read(`SELECT * FROM ${queryableName};`);
        await expect(data.rows).toEqual([['tree', 'aspen']]);
    });

    test('write without relay statement validates table name prefix', async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await getTableland(signer, {rpcRelay: false});

        const prefix = 'test_direct_invalid_write';
        await tableland.create('keyy TEXT, val TEXT', { prefix });

        const prefix2 = 'test_direct_invalid_write2'
        const { tableId } = await tableland.create('keyy TEXT, val TEXT', { prefix: prefix2 });

        // both tables owned by the same account
        // the prefix is for the first table, but id is for second table
        const queryableName = `${prefix}_31337_${tableId}`;

        await expect(async function () {
            await tableland.write(`INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`);
        }).rejects.toThrow(
          `table prefix doesn't match (exp ${prefix2}, got ${prefix})`
        );
    });

    test('write without relay statement validates table ID', async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await getTableland(signer, {rpcRelay: false});

        const prefix = 'test_direct_invalid_id_write';
        await tableland.create('keyy TEXT, val TEXT', { prefix });

        // the tableId 0 does not exist since we start with tableId == 1
        const queryableName = `${prefix}_31337_0`;

        await expect(async function () {
            await tableland.write(`INSERT INTO ${queryableName} (keyy, val) VALUES ('tree', 'aspen')`);
        }).rejects.toThrow(
          `getting table: failed to get the table: sql: no rows in result set`
        );
    });

    test('set controller without relay', async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await getTableland(signer, { rpcRelay: false });

        const prefix = 'test_create_setcontroller_norelay';
        // `key` is a reserved word in sqlite
        const { name } = await tableland.create('keyy TEXT, val TEXT', { prefix });

        const chainId = 31337;

        // Set the controller to Hardhat #7
        const { hash } = await tableland.setController('0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', name);

        expect(typeof hash).toEqual('string');
        expect(hash.length).toEqual(66);
    });

    test('set controller with relay', async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await getTableland(signer, {
            rpcRelay: true /* this is default `true`, just being explicit */
        });

        const prefix = 'test_create_setcontroller_relay';
        // `key` is a reserved word in sqlite
        const { name } = await tableland.create('keyy TEXT, val TEXT', { prefix });

        const chainId = 31337;

        // Set the controller to Hardhat #7
        const { hash } = await tableland.setController('0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', name);

        expect(typeof hash).toEqual('string');
        expect(hash.length).toEqual(66);
    });

    test('get controller returns an address', async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await getTableland(signer);

        const prefix = 'test_create_getcontroller';
        // `key` is a reserved word in sqlite
        const { name } = await tableland.create('keyy TEXT, val TEXT', { prefix });

        const chainId = 31337;
        // Hardhat #7
        const controllerAddress = '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955'

        const { hash } = await tableland.setController(controllerAddress, name);

        expect(typeof hash).toEqual('string');
        expect(hash.length).toEqual(66);

        const controller = await tableland.getController(name);

        expect(controller).toEqual(controllerAddress);
    });

    test('lock controller without relay returns a transaction hash', async function () {
        const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);

        const tableland = await getTableland(signer, { rpcRelay: false });

        const prefix = 'test_create_lockcontroller';
        // `key` is a reserved word in sqlite
        const { name } = await tableland.create('keyy TEXT, val TEXT', { prefix });

        const chainId = 31337;
        // Hardhat #7
        const controllerAddress = '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955'

        const { hash } = await tableland.setController(controllerAddress, name);

        expect(typeof hash).toEqual('string');
        expect(hash.length).toEqual(66);

        const tx = await tableland.lockController(name);

        expect(typeof tx.hash).toEqual("string");
    });

});

describe('Validator gateway server', function () {
    let token, transactionHash;
    beforeAll(async function () {
        // get our wallet, provider, and signer and a connection to tableland so that we can craft a realistic HTTP request
        const provider = new providers.JsonRpcProvider('http://localhost:8545');

        // TODO: split openapi spec tests and js tests into different files and npm commands,
        //       then `npm test` can run everything.
        const wallet0 = new Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' /* Hardhat #0 */);
        const signer0 = wallet0.connect(provider);
        const tableland0 = await getTableland(signer0);
        await tableland0.siwe();

        // We can't use the Validator's Wallet to create tables because the Validator's nonce tracking will get out of sync
        const wallet1 = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' /* Hardhat #1 */);
        const signer1 = wallet1.connect(provider);
        const tableland1 = await getTableland(signer1);

        const prefix = 'test_transaction';
        const { txnHash, tableId } = await tableland1.create('keyy TEXT, val TEXT', { prefix });

        const chainId = 31337;

        const data = await tableland1.read(`SELECT * FROM ${prefix}_${chainId}_${tableId};`);
        await expect(data.rows).toEqual([]);

        // We need the token and a transaction hash for a transaction on the Hardhat chain,
        // to run the tests for the openapi spec file so we hoist them here..
        token = tableland0.token.token;
        transactionHash = txnHash;
    });

    const tests = loadSpecTestData(path.join(__dirname, 'tmp', 'tableland-openapi-spec.yaml'), {
        chainID: 31337,
        id: 1,
        address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // Hardhat #1
        readStatement: 'SELECT * FROM healthbot_31337_1'
    });

    test.each(tests)('$name', async function (_test) {
        const payload = {
            method: _test.methodName.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            }
        };

        // Cannot have a body on a GET/HEAD request
        if (_test.body) {
            console.log(_test.body);
            // For some of the example requests we need to inject values for the chain tests are using
            if (_test.body.params && _test.body.params[0].txn_hash) _test.body.params[0].txn_hash = transactionHash;
            payload.body = JSON.stringify(_test.body);
        }

        const res = await fetch(`${_test.host}${_test.route}`, payload);

        expect(typeof _test.response).not.toEqual('undefined');

        if (_test.route === '/rpc') return await testRpcResponse(res, _test);
        await testHttpResponse(res, _test.response)
    });
});


