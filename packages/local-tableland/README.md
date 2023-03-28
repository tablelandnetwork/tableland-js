# Local Tableland

## Overview

This package contains tooling to get a sandboxed single node Tableland Network running locally. This is useful for local only development, removing the need for testnet faucets and giving you easy access to logs of everything that is happening on the tableland network during development. You can also use this package to setup end to end tests with most popular testing frameworks.

## Requirements for a Tableland Network

A Tableland Network at it's most basic is made up of two parts. An EVM compatible Blockchain with the Tableland Registry contract deployed to it, and a Tableland Validator that can listen to events emitted from the contract and materialize tables.

There are two potential paths to running a local network:

1. Use the Registry contract as an npm dependency and run a binary release of the Validator. This will be most useful for developers who want to have a local sandbox to build against, or setup automated tests that run against an actual network.
2. Use this as part of a workspace that also has the [evm-tableland](https://github.com/tablelandnetwork/evm-tableland) and [go-tableland](https://github.com/tablelandnetwork/go-tableland) repos in it. This will be most useful for working on contributing changes to tableland core. If using this setup you will probably want to create a tableland.config.js file via the cli `npx local-tableland --init`

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

Using the [JS SDK](https://github.com/tablelandnetwork/js-tableland) with a local-tableland sandboxed network is the same as any network, you just configure the provider with the chain you want to use.
For example:

```js
import { Database } from "@tableland/sdk";
import { getDefaultProvider, Wallet } from "ethers";

// The local EVM node has the default Hardhat standalone node URL
const localEvmUrl = "http://127.0.0.1:8545";
// Hardhat Public Private Key for Account 1. This is preloaded with 10,000 ETH in the local EVM node.
const privateKey =
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356";

const wallet = new Wallet(privateKey);
const provider = getDefaultProvider(localEvmUrl);
const signer = wallet.connect(provider);

const db = new Database({ signer });
```

## Programmatic Usage

If you are using Local Tableland to run tests for your project, or want to start a sandbox network programmatically for any reason, there are some helper utilities exported by this package to reduce boilerplate.
For example:

```js
import {
  LocalTableland,
  getDatabase,
  getRegistry,
  getValidator,
  getAccounts,
} from "@tableland/local";

const lt = new LocalTableland({
  // silent or verbose can be set via an options object as the first arg
  silent: true,
});

const go = async function () {
  lt.start();
  await lt.isReady();

  // Get wallets a.k.a signers for all 25 of the public Hardhat accounts.
  const accounts = getAccounts();

  // Get a Database instance that's connected to the passed in account.
  const db = getDatabase(accounts[1]);
  const response = await db
    .prepare(`CREATE TABLE my_table (id integer primary key, name text);`)
    .all();
  console.log(response);

  // Get an instance of the Registry class, more details here:
  // https://docs.tableland.xyz/javascript-sdk#4b0319e3e6384fe085d39a423ef76809
  const registry = getRegistry(accounts[1]);
  // List account 1 tables
  const myTables = await reg.listTables();
  console.log(myTables);

  // Get an instance of the Validator class, more details here:
  // https://docs.tableland.xyz/javascript-sdk#225a0a3514db48688542135258993c85
  const validator = getValidator(accounts[1]);
  const tableData = await validator.getTableById({
    chainId: 31337,
    tableId: "1",
  });
  console.log(tableData);

  await stop();
};

const stop = async function () {
  await lt.shutdown();
};

go().catch((err) => console.log(err));
```

**Best practices for testing is to start a single local network and run all of your tests against it, i.e. don't create an instance for each test. Doing this will speed up test execution significantly.**

## Writing tests for a Hardhat Project

Using Local Tableland to test a Hardhat project is straight forward. The one key point is that instead of letting hardhat automatically start a node for you, you will be letting Local Tableland start the node. To do this you simply have to include the network flag with the value `localhost`. For example, instead of running `npx hardhat test`, you should run `npx hardhat --network localhost test`

Consider the basic example below

```js
import { after, before, describe, test } from "mocha";
import { LocalTableland, getAccounts } from "@tableland/local";

const lt = new LocalTableland({
  // use the silent option to avoid cluttering the test output
  silent: true
});
const accounts = getAccounts();

before(async function () {
  this.timeout(25000);
  lt.start();
  await lt.isReady();

  // Deploy a contract to the Local Tableland Network.
  // This contract might create tables do inserts, etc...
  const Factory = await ethers.getContractFactory(
    "myContract"
  );
  const myContractInstance = (await Factory.deploy()) as myContract;
  await myContractInstance.deployed();

  // If your Contract creates tables you will have to optimistically wait to allow
  // the Validator to materialize the tables.
  // NOTE: to determine if a table has been materialized using the transaction hash
  //       you can use the REST API endpoint /receipt/{chainId}/{transactionHash}
  await new Promise(resolve => setTimeout(() => resolve(), 5000));
});

after(async function () {
  await lt.shutdown();
});

describe("Tests of myContract and associated Apps", function () {
  test("Should work end to end", async function () {
    // TODO: make first test...
  });

  // more tests...
```

There is a full working example of testing a hardhat project here: https://github.com/tablelandnetwork/example-voter/tree/main/test

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
