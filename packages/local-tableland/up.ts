/**
 *  Run end to end Tableland
 **/

import {
    cyan,
    brightGreen,
    magenta,red
} from 'https://deno.land/std@0.140.0/fmt/colors.ts';
import { delay } from 'https://deno.land/std@0.140.0/async/delay.ts';
import { readLines } from 'https://deno.land/std@0.140.0/io/mod.ts';
import { writeAll } from 'https://deno.land/std@0.140.0/io/util.ts';
import { join } from 'https://deno.land/std/path/mod.ts';

const rmImage = async function (name: string) {
    const rm = Deno.run({cmd: [
        'docker',
        'image',
        'rm',
        name,
        '-f'
    ]});
    await rm.status();
};

const cleanup = async function () {
    const pruneContainer = Deno.run({cmd: [
        'docker',
        'container',
        'prune',
        '-f'
    ]});
    await pruneContainer.status();

    await rmImage('local_api');
    await rmImage('local_database');

    const pruneVolume = Deno.run({cmd: [
        'docker',
        'volume',
        'prune',
        '-f'
    ]});
    await pruneVolume.status()

    const rmTemp = Deno.run({
        cmd: [
            'rm',
            '-rf',
            './tmp'
        ]
    });
    await rmTemp.status();

};

const pipeNamedSubprocess = async function (prefix: string, reader: Deno.Reader, writer: Deno.Writer) {
  const encoder = new TextEncoder();
  for await (const line of readLines(reader)) {
    await writeAll(writer, encoder.encode(`[${prefix}] ${line}\n`));
  }
};

const shutdown = async function () {
    await cleanup();

    Deno.exit();
};

const start = async function () {
    // make sure we are starting fresh
    await cleanup();
    const VALIDATOR_DIR = Deno.env.get('VALIDATOR_DIR');
    const HARDHAT_DIR = Deno.env.get('HARDHAT_DIR');

    if (typeof VALIDATOR_DIR !== 'string') throw new Error('you must supply path to Validator');
    if (typeof HARDHAT_DIR !== 'string') throw new Error('you must supply path to Hardhat');

    // Run a local hardhat node
    const hardhat = Deno.run({
        cwd: HARDHAT_DIR,
        cmd: [
            'npm',
            'run',
            'up'
        ],
        stdout: 'piped',
        stderr: 'piped'
    });
    // NOTE: the process should keep running until we kill it
    pipeNamedSubprocess(cyan('Hardhat'), hardhat.stdout, Deno.stdout);
    pipeNamedSubprocess(red('Hardhat'), hardhat.stderr, Deno.stderr);

    // very naive way to let the Hardhat node start before deploying to it
    await delay(31 * 1000);

    // Deploy the Registry to the Hardhat node
    const deployRegistry = Deno.run({
        cwd: HARDHAT_DIR,
        cmd: [
            'npx',
            'hardhat',
            'run',
            '--network',
            'localhost',
            'scripts/deploy.ts'
        ],
        stdout: 'piped',
        stderr: 'piped'
    });
    pipeNamedSubprocess(brightGreen('Deploy Registry:'), deployRegistry.stdout, Deno.stdout);
    pipeNamedSubprocess(red('Deploy Registry:'), deployRegistry.stderr, Deno.stderr);

    // wait till the deploy finishes
    await deployRegistry.status();

    // start the validator
    const validator = Deno.run({
        cwd: VALIDATOR_DIR,
        cmd: [
            'make',
            'up'
        ],
        env: {
            CONFIG_FILE: 'config.json'
        },
        stdout: 'piped',
        stderr: 'piped'
    });
    // NOTE: the process should keep running until we kill it
    pipeNamedSubprocess(magenta('Validator'), validator.stdout, Deno.stdout);
    pipeNamedSubprocess(red('Validator'), validator.stderr, Deno.stderr);

    // copy the api spec to a place the tests can find it
    const mkdirTemp = Deno.run({
        cmd: [
            'mkdir',
            './tmp'
        ]
    });
    await mkdirTemp.status();

    const openApiSpec = Deno.run({
        cmd: [
            'cp',
            join(VALIDATOR_DIR, '..', 'tableland-openapi-spec.yaml'),
            './tmp'
        ]
    });
    await openApiSpec.status();

    // very naive way to let the Validator start before signaling that things are all running
    await delay(31 * 1000);

    console.log('Tableland is running!')
};

Deno.addSignalListener('SIGINT', shutdown);
Deno.addSignalListener('SIGQUIT', shutdown);

await start();
