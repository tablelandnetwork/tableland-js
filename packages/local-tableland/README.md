# Local Tableland

## Overview

This repo contains tooling to get a sandboxed single node Tableland Network running locally. This is under active developement and subject to breaking changes without warning.

Potential uses include:

- connecting to a local instance of tableland so initial testing and development doesn't need to rely on a testnet like Mumbai or Görli.
- Running end to end tests while contributing changes to core Tableland products like the [JS SDK](https://github.com/tablelandnetwork/js-tableland), [Smart Contract](https://github.com/tablelandnetwork/evm-tableland), and/or the [Validator](https://github.com/tablelandnetwork/go-tableland).
- Exploring, writing, and debuggin Policy Contracts.
- Enabling automated tests that run against an actual Tableland Network

## Requirements for a Tableland Network

A Tableland Network at it's most basic is made up of two parts. An EVM compatable Blockchain with the Tableland Registry contract deployed to it, and a Tableland Validator that can listen to events emitted from the contract.
This repository does not contain either of those parts. It contains tooling to help automate setup, configuration, and running of a network. All of this requires that you have Node.js (including npm and npx), Docker, and Git installed.

## Quick Start

Once Docker is running just do `npx local-tableland` and an interactive prompt will open and guide you through setting up your Tableland project. After setup is done you can do `npx local-tableland` again and a locally running tableland network will start. You can now connect your app, deploy contracts, and develop in a sandboxed environment without spending testnet coin.

## Configuring Your Wallet to Connect

Under the hood Local Tableland is running an in memory instance of Hardhat Network. When connecting a wallet the RPC URL is http://127.0.0.1:8545 and the chainId is 31337. Checkout the [Hardhat docs](https://hardhat.org/hardhat-runner/docs/getting-started#connecting-a-wallet-or-dapp-to-hardhat-network) for more details.

## Connecting With The JS SDK

Using the [JS SDK](https://github.com/tablelandnetwork/js-tableland) is very straight forward. In the connection options simply specify `chain: 'local-tableland'`. For example:

```
import { connect } from '@tableland/sdk';
const tableland = connect({ chain: 'local-tableland' });
```

## More Detailed Setups

If you are using Local Tableland to run tests for your project
TODO:

If you are using this while contributing to the JS SDK, the Validator, or the Registry contract
TODO:

## Notes

Keep and eye out for Zombie processes. Killing the process should kill all of the subprocesses, and cleanup everything Docker has done during startup. But it's still worth watching for zombies 🧟, if you find any problems or ways for this tooling to better manage cleanup please open an issue.
