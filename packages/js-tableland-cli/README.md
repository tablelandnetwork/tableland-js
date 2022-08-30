# @tableland/cli

[![Review](https://github.com/tablelandnetwork/js-tableland-cli/actions/workflows/review.yml/badge.svg)](https://github.com/tablelandnetwork/js-tableland-cli/actions/workflows/review.yml)
[![License](https://img.shields.io/github/license/tablelandnetwork/js-tableland-cli.svg)](./LICENSE)
[![Version](https://img.shields.io/github/package-json/v/tablelandnetwork/js-tableland-cli.svg)](./package.json)
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
- [Contributing](#contributing)
- [License](#license)

# Background

An experimental Tableland command line tool.

# Usage

```bash
tableland [command]

Commands:
  tableland chains                    List information about supported chains
  tableland controller <sub>          Get, set, and lock the controller contract
                                      for a given table
  tableland create <schema> [prefix]  Create a new table
  tableland hash <schema> [prefix]    Validate a table schema and get the structure
                                      hash
  tableland info <name>               Get info about a given table by name
  tableland list [address]            List tables by address
  tableland read <query>              Run a read-only query against a remote table
  tableland receipt <hash>            Get the receipt of a chain transaction to
                                      know if it was executed, and the execution
                                      details
  tableland schema <name>             Get info about a given table schema
  tableland structure <hash>          Get table name(s) by schema structure hash
  tableland token                     Create a SIWE token
  tableland write <statement>         Run a mutating SQL statement against a remote
                                      table

Options:
      --help        Show help                                          [boolean]
      --version     Show version number                                [boolean]
  -k, --privateKey  Private key string                                  [string]
  -c, --chain       The EVM chain to target [string] [default: "polygon-mumbai"]
  -r, --rpcRelay    Whether writes should be relayed via a validator   [boolean]
      --alchemy     Alchemy provider API key                            [string]
      --infura      Infura provider API key                             [string]
      --etherscan   Etherscan provider API key                          [string]
```

# Install

You can install via npm.

```
npm install -g @tableland/cli
```

# Development

Get started with installing and building the project:

```shell
npm install
npm run build
```

# Contributing

PRs accepted.

Small note: If editing the README, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

# License

MIT AND Apache-2.0, © 2021-2022 Tableland Network Contributors
