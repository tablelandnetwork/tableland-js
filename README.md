# Tableland JavaScript Packages

[![License: MIT AND Apache-2.0](https://img.shields.io/badge/License-MIT%20AND%20Apache--2.0-blue.svg)](./LICENSE)
[![SDK Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftablelandnetwork%2Ftableland-js%2Fmain%2Fpackages%2Fsdk%2Fpackage.json&query=%24.version&label=SDK)](./package.json)
[![CLI Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftablelandnetwork%2Ftableland-js%2Fmain%2Fpackages%2Fcli%2Fpackage.json&query=%24.version&label=CLI)](./package.json)
[![Local Tableland Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftablelandnetwork%2Ftableland-js%2Fmain%2Fpackages%2Flocal%2Fpackage.json&query=%24.version&label=Local%20Tableland)](./package.json)
[![Node Helpers Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftablelandnetwork%2Ftableland-js%2Fmain%2Fpackages%2Fnode-helpers%2Fpackage.json&query=%24.version&label=Node%20Helpers)](./package.json)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg)](https://github.com/RichardLitt/standard-readme)

> Tableland JavaScript—clients & tools to build with the Tableland database protocol.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Background

The `@tableland` packages provide a JavaScript SDK, CLI, and Local Tableland node for developers to build with the Tableland database protocol, along with a Node Helpers library for SDK-related utility functions. This monorepo contains the following packages:

- `@tableland/sdk`: A JavaScript SDK for interacting with the Tableland database protocol.
- `@tableland/cli`: A command line interface for interacting with Tableland.
- `@tableland/local`: Sandboxed Local Tableland nodes for testing and development. Both JavaScript and TypeScript are supported.
- `@tableland/node-helpers`: A library for SDK-related utility functions in Node.js environments. Both JavaScript and TypeScript are supported.

## Install

You can install each of these via npm:

```bash
npm i @tableland/sdk
npm i -g @tableland/cli
npm i -g @tableland/local
npm i @tableland/node-helpers
```

Or yarn:

```bash
yarn add @tableland/sdk
yarn global add @tableland/cli
yarn global add @tableland/local
yarn add @tableland/node-helpers
```

## Usage

The full documentation for each of these is [available on our docs site](https://docs.tableland.xyz/sdk/). Here a brief overview of each:

- [SDK](packages/sdk/README.md): Create a `Database` instance to interact with Tableland, including creating tables, inserting data, and querying data. Both JavaScript and TypeScript are supported.
- [CLI](packages/cli/README.md): Interact with Tableland from the command line, including creating tables, inserting data, and querying data—plus some other features for inserting data from files or working from a shell.
- [Local Tableland](packages/local/README.md): Create a sandboxed Tableland node for testing and development, which can be used in parallel with the CLI, SDK, smart contract frameworks (e.g., Hardhat), or testing frameworks (e.g., mocha).
- [Node Helpers](packages/node-helpers/README.md): A Node Helpers library for SDK-related utility functions, like aliasing table names.

## Development

Get started by cloning, installing, building, and testing the project:

```shell
git clone git@github.com:tablelandnetwork/tableland-js.git
cd tableland-js
npm install
npm run build
npm test
```

If you make any changes to the code, make sure you also run the linter and prettier before committing:

```shell
npm run format
```

## Contributing

PRs accepted.

Small note: If editing the README, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

MIT AND Apache-2.0, © 2021-2023 Tableland Network Contributors
