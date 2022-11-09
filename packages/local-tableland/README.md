# Local Tableland

## Overview

This repo contains tooling to get a sandboxed single node Tableland Network running locally. This is under active development and subject to breaking changes without warning.

**Currently working with Mac and Linux, windows support coming soon.**

## Requirements for a Tableland Network

A Tableland Network at it's most basic is made up of two parts. An EVM compatible Blockchain with the Tableland Registry contract deployed to it, and a Tableland Validator that can listen to events emitted from the contract and materialize tables.
This repo contains tooling to help automate setup, configuration, and running of a network.

There are two potential paths to running a local network with this repo:

1. This repo contains the Registry contract as an npm dependency and a binary release of the Validator. This will be most useful for developers who want to have a local sandbox to build against, or setup CI tests that run against an actual network.
2. This repo can be part of a workspace that also has the [evm-tableland](https://github.com/tablelandnetwork/evm-tableland) and [go-tableland](https://github.com/tablelandnetwork/go-tableland) repos in it. This will be most useful for working on contributing changes to tableland core. If using this setup you will probably want to create a tableland.config.js file via the cli `npx local-tableland --init`

## Quick Start

For the first case above getting up and running is as easy as:
`npm install --save-dev @tableland/local`
`npx local-tableland`

This will start a network and you will see logs from both the Registry and the Validator which are prefixed with the origin of the log.
If you want to silence the logs you can use the silent flag, i.e. `npx local-tableland --silent`
If you want verbose logs you can use the verbose flag, i.e. `npx local-tableland --verbose`

## Configuring Your Wallet to Connect

Under the hood Local Tableland is running an in memory instance of Hardhat Network. When connecting a wallet the RPC URL is http://127.0.0.1:8545 and the chainId is 31337. Checkout the [Hardhat docs](https://hardhat.org/hardhat-runner/docs/getting-started#connecting-a-wallet-or-dapp-to-hardhat-network) for more details.

## Connecting With The JS SDK

Using the [JS SDK](https://github.com/tablelandnetwork/js-tableland) with a local-tableland sandboxed network is straight forward. In the SDK connection options simply specify `chain: 'local-tableland'`.
For example:

```
import { connect } from '@tableland/sdk';
const tableland = connect({ chain: 'local-tableland' });
```

## Programmatic Usage

If you are using Local Tableland to run tests for your project, or want to start a sandbox network programmatically for any reason, the following example covers the basics

```
import { LocalTableland } from "@tableland/local";

const lt = new LocalTableland({ /* silent or verbose can be set via an options object as the first arg */ });

const go = async function () {
  lt.start();
  await lt.isReady();
};

const stop = async function () {
  await lt.shutdown();
};

go().catch(err => console.log(err));
```

**Best practice for this repo is to start a single network to run all of your tests against, don't create an instance for each test.**

## Setup as a Workspace for Tableland Core Contributing

If you are using this while contributing to the the Validator, or the Registry contract you may find yourself wanting to see if your local changes are working across the entire network. In this case you will want to use this repo in conjunction with the [evm-tableland](https://github.com/tablelandnetwork/evm-tableland) and [go-tableland](https://github.com/tablelandnetwork/go-tableland) repos.
The easiest way to do this is by putting the three repos in the same directory and creating a tableland.config.js file. You can create this via the cli with `npx local-tableland --init`, or do it manually. [See src/tableland.config.js](https://github.com/tablelandnetwork/local-tableland/blob/main/src/tableland.config.example.ts) for an example written in typescript.

Once you have your changes to the Validator and/or the Registry you can run `npm test` in this repo to see if your changes broke anything.

## Notes

Keep and eye out for Zombie processes. Killing the process should kill all of the sub-processes, and cleanup everything (including Docker if relevant) done during startup. But it's still worth watching for zombies 🧟, if you find any problems or ways for this tooling to better manage cleanup please open an issue.

## Contributing

PRs accepted.

Small note: If editing the README, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

MIT AND Apache-2.0, © 2021-2022 Tableland Network Contributors
