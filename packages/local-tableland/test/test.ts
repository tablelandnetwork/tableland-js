import { connect } from '@tableland/sdk';
import { Wallet, providers } from 'ethers';
import { spawn } from 'child_process';
import { createInterface } from 'readline';


describe("Validator, Chain, and SDK work end to end", function () {

    let tablelandProcess;
    beforeAll(function (done) {
        return done(); // TODO: figure out why the child process won't start
        /*
        tablelandProcess = spawn('deno run', [
            '--allow-run',
            '--allow-env',
            'up.ts'
        ], {
            env: {
                HARDHAT_DIR: process.env.HARDHAT_DIR,
                VALIDATOR_DIR: process.env.VALIDATOR_DIR
            }
        });

        tablelandProcess.stdout.on('data', function (data) {
            var buff = new Buffer(data);
            console.log("foo: " + buff.toString('utf8'));
        });

        tablelandProcess.stderr.on('data', function (data) {
            data += '';
            console.log(data.replace("\n", "\nstderr: "));
        });

        tablelandProcess.on('exit', function (code) {
            console.log('child process exited with code ' + code);
            process.exit(code);
        });


        const tlMessages = createInterface({
            input: tablelandProcess.stdout,
            crlfDelay: Infinity
        });

        console.log('reading lines until it looks like Tableland is running');
        for await (const line of tlMessages) {
            console.log(line);
            if (line.match('Tableland is running!')) break;
        }
        console.log('should never get here...');
        */
    }, 60000 /* allow 60 seconds for tableland to start */);

    afterAll(function (done) {
        return done(); // TODO: figure out why the child process won't start
        tablelandProcess.on('close', () => done());
        tablelandProcess.kill('SIGINT');
    });

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
