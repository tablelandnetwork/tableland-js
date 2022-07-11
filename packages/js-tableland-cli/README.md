# @tableland/cli

[![GitHub license](https://img.shields.io/github/license/tablelandnetwork/js-tableland-cli.svg)](./LICENSE)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/tablelandnetwork/js-tableland-cli.svg)](./package.json)
[![Release](https://img.shields.io/github/release/tablelandnetwork/js-tableland-cli.svg)](https://github.com/tablelandnetwork/js-tableland-cli/releases/latest)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg)](https://github.com/RichardLitt/standard-readme)

> Tableland command line tool

# Table of Contents

- [@tableland/cli](#tablelandcli)
- [Table of Contents](#table-of-contents)
- [Background](#background)
- [Usage](#usage)
- [Install](#install)
- [Development](#development)
  - [Building a binary](#building-a-binary)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

# Background

An experimental Tableland command line tool.

# Usage

```bash
tableland [command]

Commands:
  tableland chains                    List information about supported chains
  tableland create <schema> [prefix]  Create a new table
  tableland info <id>                 Get info about a given table by id
  tableland list [address]            List tables by address
  tableland read <query>              Run a read-only query against a remote table
  tableland receipt <hash>            Get the receipt of a chain transaction to
                                      know if it was executed, and the execution
                                      details
  tableland token                     Create a SIWE token
  tableland write <statement>         Run a mutating SQL statement against a remote
                                   table

Options:
      --help        Show help                                          [boolean]
      --version     Show version number                                [boolean]
  -k, --privateKey  Private key string                                  [string]
  -h, --host        Remote API host (e.g.
                    https://{testnet}.tableland.network)
                       [string] [default: "https://testnet.tableland.network"]
      --chain       The EVM compatible chain to target
                                           [string] [default: "ethereum-goerli"]
      --alchemy     Alchemy provider API key                            [string]
      --infura      Infura provider API key                             [string]
      --etherscan   Etherscan provider API key                          [string]
  -t, --token       Signed SIWE token (see `token --help`)              [string]
```

# Install

You can install via npm. Homebrew etc coming soon!

```
npm install -g @tableland/cli
```

# Development

Get started with installing and building the project:

```shell
npm install
npm run build
```

## Building a binary

You can build a binary to be used for [(say) homebrew](https://medium.com/geekculture/building-a-node-js-cli-with-typescript-packaged-and-distributed-via-homebrew-15ba2fadcb81) in the future:

```shell
npm install
npm run build
npm run package
```

# Maintainers

[@carsonfarmer](https://github.com/carsonfarmer)

# Contributing

PRs accepted.

Small note: If editing the README, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

# License

MIT AND Apache-2.0, © 2021-2022 Tableland Network Contributors
