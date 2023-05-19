# @tableland/local

[![Review](https://github.com/tablelandnetwork/local-tableland/actions/workflows/review.yml/badge.svg)](https://github.com/tablelandnetwork/local-tableland/actions/workflows/review.yml)
[![Test](https://github.com/tablelandnetwork/local-tableland/actions/workflows/test.yml/badge.svg)](https://github.com/tablelandnetwork/local-tableland/actions/workflows/test.yml)
[![Publish](https://github.com/tablelandnetwork/local-tableland/actions/workflows/publish.yml/badge.svg)](https://github.com/tablelandnetwork/local-tableland/actions/workflows/publish.yml)
[![License](https://img.shields.io/github/license/tablelandnetwork/local-tableland.svg)](./LICENSE)
[![Version](https://img.shields.io/github/package-json/v/tablelandnetwork/local-tableland.svg)](./package.json)
[![Release](https://img.shields.io/github/release/tablelandnetwork/local-tableland.svg)](https://github.com/tablelandnetwork/local-tableland/releases/latest)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg)](https://github.com/RichardLitt/standard-readme)

> A lightweight development environment for Tableland databases.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
  - [Silencing logs](#silencing-logs)
  - [Wallet \& Endpoint Configuration](#wallet--endpoint-configuration)
  - [Using with the Tableland SDK](#using-with-the-tableland-sdk)
  - [Using with a Hardhat Project](#using-with-a-hardhat-project)
  - [Core Protocol Development](#core-protocol-development)
  - [Notes](#notes)
- [Contributing](#contributing)
- [License](#license)

## Background

Local Tableland provides developers with a user-friendly, lightweight development environment for working with Tableland, making it easier to build, test, and deploy decentralized database applications in web3. You can create a local sandbox environment to build or set up automated tests against a Local Tableland network.

A Tableland network is fundamentally made up of two parts:

- An EVM compatible blockchain with the Tableland Registry contract deployed to it.
- A Tableland Validator node that can listen to events emitted from the contract and materialize tables.

This package contains tooling to get a sandboxed single Tableland network node running locally aside a Hardhat blockchain node. It is useful for local-only development, removing the need for testnet faucets and giving you easy access to logs of everything that is happening on the Tableland network during development.

## Install

From your project, install the `@tableland/local` package as a development dependency:

```bash
npm install --save-dev @tableland/local
```

## Usage

To spin up a Local Tableland network, you can run the following:

```bash
npx local-tableland
```

Under the hood, this will run a binary release of the Tableland Validator, using the Tableland Registry smart contract as an `npm` dependency and deploying it to the local Hardhat blockchain node. To shut down Local Tableland, simply quit / exit your terminal session.

### Silencing logs

You will see logs from both the Registry contract and the Validator, which are prefixed with the origin of the log. If you want to silence the logs, you can use the `silent` flag; verbose logs (default) use the `verbose` flag:

```bash
npx local-tableland --silent
npx local-tableland --verbose
```

### Wallet & Endpoint Configuration

Under the hood, Local Tableland is running an in-memory instance of a Hardhat network. To connect and interact with the Hardhat network (e.g., using a browser wallet), you'll need to use the following:

- **RPC URL**: `http://127.0.0.1:8545`
- **Chain ID**: `31337`

Checkout the [Hardhat docs](https://hardhat.org/hardhat-runner/docs/getting-started#connecting-a-wallet-or-dapp-to-hardhat-network) for more details.

Separately, a Local Tableland node is running. You can interact with the node at the following base URL, such as using any of the [Gateway APIs](https://docs.tableland.xyz/gateway-api/) or [CLI](https://docs.tableland.xyz/cli/) tool:

- **Base URL**: `http://localhost:8080`

### Using with the Tableland SDK

Using the [JavaScript SDK](https://github.com/tablelandnetwork/js-tableland) with a Local Tableland sandboxed network is the same as any network; you simply configure the `provider` with the chain you want to use. For example, you can pass the local URL `http://127.0.0.1:8545` to `getDefaultProvider` from `ethers` and connect the `signer` to it:

```js
import { Database } from "@tableland/sdk";
import { getDefaultProvider, Wallet } from "ethers";

// The local EVM node uses the default Hardhat standalone node URL.
const localProviderUrl = "http://127.0.0.1:8545";
// Hardhat-provided private key (the second account).
const privateKey =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const wallet = new Wallet(privateKey);
const provider = getDefaultProvider(localProviderUrl);
const signer = wallet.connect(provider);

const db = new Database({ signer });
```

When you spin up a Hardhat node, it comes with a setup of default accounts preloaded with 10,000 local-only ETH (symbol: `GO`); these accounts have totally open private keys. The example above (`0x59c6...`) is the _second_ account since the first one is already used by Local Tableland when deploying the Registry contract.

#### Using in Tests & Programmatically

If you are using Local Tableland to run tests for your project, or want to start a sandbox network programmatically for any reason, there are some helper utilities exported by this package to help reduce boilerplate. For example, the following demonstrates how to start a local node by:

- Instantiating `LocalTableland`.
- Starting the network up and making sure it's ready.
- Retrieving connected account (from Hardhat).
- Getting / connecting a `Database`.
- Getting a `Registry` or `Validator` instance (via the SDK).
- Stopping the network.

```js
import {
  LocalTableland,
  getDatabase,
  getRegistry,
  getValidator,
  getAccounts,
} from "@tableland/local";

// Create an instance of Local Tableland.
const lt = new LocalTableland({
  // Silent or verbose can be set via an options object as the first arg.
  silent: true,
});

const go = async function () {
  // Start up Local Tableland and make sure it's ready to be interacted with.
  lt.start();
  await lt.isReady();

  // Get wallets aka signers for all 25 of the public Hardhat accounts.
  const accounts = getAccounts();

  // Get a Database instance that's connected to the passed in account.
  const db = getDatabase(accounts[1]);
  const response = await db
    .prepare(`CREATE TABLE my_table (id integer primary key, name text);`)
    .all();
  console.log(response);

  // Get an instance of the Registry class; more details here:
  // https://docs.tableland.xyz/sdk/core/registry-api
  const registry = getRegistry(accounts[1]);
  // List the tables owned by `accounts[1]`
  const myTables = await registry.listTables();
  console.log(myTables);

  // Get an instance of the Validator class; more details here:
  // https://docs.tableland.xyz/sdk/core/validator-api
  const validator = getValidator(db.config.baseUrl);
  const tableData = await validator.getTableById({
    chainId: 31337,
    tableId: "1",
  });
  console.log(tableData);

  // Stop Local Tableland.
  await stop();
};

// Code to shutdown the Tableland and Hardhat nodes.
const stop = async function () {
  await lt.shutdown();
};

// Catch errors and log them.
go().catch((err) => console.log(err));
```

> A best practice for testing is to start a single local network and run all of your tests against it, i.e., don't create an instance for each test. Doing this will speed up test execution significantly!

### Using with a Hardhat Project

Using Local Tableland to test a Hardhat project is straightforward. The one key point is that instead of letting Hardhat automatically start a node for you, _you will be letting Local Tableland start the node_. To do this, you simply have to include the network flag with the value `localhost`. For example, instead of running `npx hardhat test`, you should run:

```bash
npx hardhat --network localhost test
```

Consider the basic example below that assumes you have created `MyContract` in your Hardhat project and are deploying it. It imports `mocha` for writing the tests along with some of the helper methods outlined in the previous example.

```js
import { after, before, describe, test } from "mocha";
import { LocalTableland, getAccounts } from "@tableland/local";

// Create an instance of Local Tableland.
const lt = new LocalTableland({
  // Silent or verbose can be set via an options object as the first arg.
  silent: true,
});
const accounts = getAccounts();

// Create and start a single instance (i.e., not for each test).
before(async function () {
  this.timeout(25000);
  lt.start();
  await lt.isReady();

  // Deploy a contract to the Local Tableland network.
  // This contract might create tables do inserts, etc...
  const Factory = await ethers.getContractFactory(
    "MyContract"
  );
  const myContractInstance = (await Factory.deploy()) as MyContract;
  await myContractInstance.deployed();

  // If your Contract creates tables, you will have to optimistically wait to allow
  // the Validator to materialize them.
  // NOTE: to determine if a table has been materialized using the transaction hash,
  //       you can use the REST API endpoint: `/api/v1/receipt/{chainId}/{transactionHash}`
  await new Promise(resolve => setTimeout(() => resolve(), 5000));
});

after(async function () {
  await lt.shutdown();
});

describe("Test MyContract and other apps", function () {
  test("Should work end to end", async function () {
    // Test an end to end example
  });

  // More tests...
})
```

See [here](https://github.com/tablelandnetwork/example-voter/tree/main/test) for a full working example of testing a Hardhat project.

### Core Protocol Development

For those _contributing_ to the core Tableland protocol, a common pattern is to spin up Local Tableland to interact with any changes you make to the core software during development: [evm-tableland](https://github.com/tablelandnetwork/evm-tableland) and [go-tableland](https://github.com/tablelandnetwork/go-tableland). This helps you check if your local changes are working across the entire network.

Set up a workspace that has all three of these repos cloned into it.

```bash
git clone https://github.com/tablelandnetwork/evm-tableland
git clone https://github.com/tablelandnetwork/go-tableland
git clone https://github.com/tablelandnetwork/local-tableland
```

Your workspace should have the following directories:

```md
.
├── evm-tableland
├── go-tableland
└── local-tableland
```

Then, you will want to `cd` into `local-tableland` and create a `tableland.config.js` file by running:

```bash
npx local-tableland --init
```

This will create `tableland.config.js` in the root of the `local-tableland` directory; it defines the relative paths to the aforementioned core protocol directories:

```js
module.exports = {
  validatorDir: "../go-tableland",
  registryDir: "../evm-tableland",
  verbose: false,
  silent: false,
};
```

Once this is all set up, you can check if any changes you make to `go-tableland` and/or `evm-tableland` code cause things to break. Do this by running the following command _from within_ the `local-tableland` directory:

```bash
npm test
```

### Notes

Keep an eye out for zombie processes. Killing the Local Tableland process _should_ kill all of the sub-processes, and the cleanup of everything (including Docker, if relevant) is done during startup. But, it's still worth keeping an eye out—and if you find any problems or ways for this tooling to better manage cleanups, please open an issue!

## Contributing

PRs accepted.

Small note: If editing the README, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

MIT AND Apache-2.0, © 2021-2022 Tableland Network Contributors
