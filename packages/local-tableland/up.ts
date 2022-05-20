/**
 * Run end to end Tableland
 */
import { readLines } from 'https://deno.land/std@0.140.0/io/mod.ts';
import { writeAll } from 'https://deno.land/std@0.140.0/io/util.ts';
import { cyan, brightGreen, magenta, red } from 'https://deno.land/std@0.140.0/fmt/colors.ts'

const cleanup = async function () {
    const pruneContainer = Deno.run({cmd: [
        'docker',
        'container',
        'prune',
        '-f'
    ]})
    await pruneContainer.status();

    const removeApi = Deno.run({cmd: [
        'docker',
        'image',
        'rm',
        'local_api',
        '-f'
    ]})
    await removeApi.status();

    const removeDb = Deno.run({cmd: [
        'docker',
        'image',
        'rm',
        'local_database',
        '-f'
    ]})
    await removeDb.status();

    const pruneVolume = Deno.run({cmd: [
        'docker',
        'volume',
        'prune',
        '-f'
    ]})
    await pruneVolume.status()

};

const pipeNamedSubprocess = async function (prefix: string, reader: Deno.Reader, writer: Deno.Writer) {
  const encoder = new TextEncoder();
  for await (const line of readLines(reader)) {
    await writeAll(writer, encoder.encode(`[${prefix}] ${line}\n`));
  }
}

const wait = async function (ms: number) {
    return new Promise(function (resolve, reject) {
        setTimeout(() => resolve(void 0), ms);
    });
}

const shutdown = async function () {
    await cleanup();

    Deno.exit();
}

const start = async function () {
    // make sure we are starting fresh
    await cleanup();

    // Run a local hardhat node
    const hardhat = Deno.run({
        cwd: Deno.env.get('HARDHAT_DIR'),
        cmd: [
            'npm',
            'run',
            'up'
        ],
        stdout: 'piped',
        stderr: 'piped'
    });
    console.log(hardhat);
    // NOTE: the process should keep running until we kill it
    pipeNamedSubprocess(cyan('Hardhat'), hardhat.stdout, Deno.stdout);
    pipeNamedSubprocess(red('Hardhat'), hardhat.stderr, Deno.stderr);

    // very naive way to let the Hardhat node start before deploying to it
    await wait(31 * 1000);

    // Deploy the Registry to the Hardhat node
    const deployRegistry = Deno.run({
        cwd: Deno.env.get('HARDHAT_DIR'),
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
        cwd: Deno.env.get('VALIDATOR_DIR'),
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
}

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGQUIT", shutdown);

await start();
