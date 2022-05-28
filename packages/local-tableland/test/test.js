import { connect } from '@tableland/sdk';
import { Wallet, providers } from 'ethers';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { jest } from '@jest/globals';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

const __dirname = path.resolve(path.dirname(''));
const HOST = 'http://localhost:8080';

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

describe('Validator, Chain, and SDK work end to end', function () {
    // NOTE: these tests require the a local Tableland is already running

    test('Create a table that can be read from', async function () {
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

    test('Create a table that can be written to', async function () {
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

    test('Table cannot be written to unless caller is allowed', async function () {
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

    test('Create a table can have a row deleted', async function () {
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

    test('List an account\'s tables', async function () {
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

// The open api spec file routes are templated with single squiggle brakets {} 
// This is a simple implementation of rendering that type of template
const renderPath = function (tmpl, data) {
    let rendered = '';
    for (let i = 0; i < tmpl.length; i++) {
        if (tmpl[i] !== '{') {
            rendered += tmpl[i];
            continue;
        }

        const open = i;
        const close = tmpl.indexOf('}');

        const val = data[tmpl.slice(open + 1, close)].toString();

        return renderPath(`${tmpl.slice(0, open)}${val}${tmpl.slice(close + 1)}`, data);
    }

    return rendered;
};

describe('Validator gateway server', function () {
    let token;
    beforeAll(async function () {
        // get our wallet, provider, and signer and a connection to tableland so that we can craft a realistic HTTP request
        const wallet = new Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' /* Hardhat #0 */);
        const provider = new providers.JsonRpcProvider('http://localhost:8545');
        const signer = wallet.connect(provider);
        const tableland = await connect({
            signer: signer,
            network: 'local',
            host: HOST
        });

        token = tableland.token.token;
    });

    const tests = [];

    // Let's consume the open api spec and map it to fetch requests that we can test the spec's responses against
    const spec = yaml.load(fs.readFileSync(path.join(__dirname, 'tmp', 'tableland-openapi-spec.yaml'), 'utf8'));
    const routes = [];

    for (const routeTemplate in spec.paths) {
        // NOTE: the template and data variable names are defined in the spec
        const route = renderPath(routeTemplate, {
            chainID: 31337,
            id: 1,
            ethAddress: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' // Hardhat #1
        });

        const methods = Object.keys(spec.paths[routeTemplate]).reduce((acc, cur) => {
            const method = {
                name: cur
            };
            if (cur === 'post') {
                // TODO: this is obviously a hack, we could map all the content types to an example request,
                //       but currently there's only application/json
                method.examples = spec.paths[routeTemplate][cur].requestBody.content['application/json'].examples
            }
            acc.push(method);
            return acc;
        }, []);

        routes.push({ route, routeTemplate, methods });
    }

    // Now we have the routes methods and what the request body's (if any) look like
    for (let i = 0; i < routes.length; i++) {
        const route = routes[i].route;
        const routeTemplate = routes[i].routeTemplate;

        for (let j = 0; j < routes[i].methods.length; j++) {
            const method = routes[i].methods[j];
            const examples = method.examples ? Object.keys(method.examples) : [''];

            for (let k = 0; k < examples.length; k++) {
                const exampleName = examples[k];
                const body = method.examples ? method.examples[exampleName].value : '';

                tests.push({
                    name: `API spec file: ${routeTemplate} ${method.name} ${exampleName}`,
                    host: HOST,
                    route,
                    methodName: method.name,
                    body
                });
            }
        }
    }

    const testRpcResponse = async function (res) {
        if (!res.ok) throw new Error(res.statusText);

        const json = await res.json();

        if (json.error) throw new Error(json.error.message);
        if (!json.result) throw new Error("Malformed RPC response");
    };
    const testHttpResponse = async function (res) {
        if (!res.ok) throw new Error(res.statusText);

        const json = await res.json();

        // TODO: anything else to test here?
    };

    test.each(tests)('$name', async function (_test) {
        const payload = {
            method: _test.methodName.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            }
        };

        // Cannot have a body on a GET/HEAD request
        if (_test.body) payload.body = JSON.stringify(_test.body);

        const res = await fetch(`${_test.host}${_test.route}`, payload);

        if (_test.route === '/rpc') return await testRpcResponse(res);
        await testHttpResponse(res)
    });
});

