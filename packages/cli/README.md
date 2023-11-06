# @tableland/cli

[![Review](https://github.com/tablelandnetwork/tableland-js/actions/workflows/review.yml/badge.svg)](https://github.com/tablelandnetwork/tableland-js/actions/workflows/review.yml)
[![Test](https://github.com/tablelandnetwork/tableland-js/actions/workflows/test.yml/badge.svg)](https://github.com/tablelandnetwork/tableland-js/actions/workflows/test.yml)
[![License: MIT AND Apache-2.0](https://img.shields.io/badge/License-MIT%20AND%20Apache--2.0-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftablelandnetwork%2Ftableland-js%2Fmain%2Fpackages%2Fcli%2Fpackage.json&query=%24.version&label=Version)](./package.json)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg)](https://github.com/RichardLitt/standard-readme)

> Tableland command line tool for interacting with your Tableland database & tables

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Config](#config)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Background

The `@tableland/cli` allows you to interact with your Tableland database & tables from the comfort of the command line. It's a wrapper around the `@tableland/sdk` along with some additional features, and you can use it to create tables, run queries, and more.

## Install

You can install globally via npm:

```
npm install -g @tableland/cli
```

Or yarn:

```bash
yarn global add @tableland/cli
```

## Usage

Full library documentation is [available on our docs site](https://docs.tableland.xyz/cli/). The available commands include:

- `chains`: List information about supported chains.
- `controller <sub>`: Get, set, and lock the controller contract for a given table.
- `create [schema] [prefix]`: Create a new table.
- `info <name>`: Get info about a given table by name.
- `init`: Create config file.
- `list [address]`: List tables by address.
- `read [statement]`: Run a read-only query against a remote table.
- `receipt <hash>`: Get the receipt of a chain transaction to know if it was executed, and the execution details.
- `schema <name>`: Get info about a given table schema.
- `write [statement]`: Run a mutating SQL statement against a remote table.
- `shell [statement]`: Interact with tableland via an interactive shell environment.
- `namespace <domain> [mappings..]`: Manage ENS names for tables.
- `transfer <name> <receiver>`: Transfer a table to another address.

The available options are:

- `--help`, `-h`: Show help.
- `--version`, `-V`: Show version number.
- `--baseUrl`: The URL of your Tableland validator.
- `--chain`, `-c`: The EVM chain to target.
- `--enableEnsExperiment`: Enable ENS experiment.
- `--ensProviderUrl`: Enable ENS experiment.
- `--privateKey`, `-k`: Private key string.
- `--providerUrl`, `-p`: JSON RPC API provider URL (e.g., `https://eth-sepolia.g.alchemy.com/v2/123abc123a...`).
- `--aliases`, `-a`: Path to table aliases JSON file (e.g., `./tableland.aliases.json`).

## Config

`@tableland/cli` uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for configuration file support. This means you can configure `@tableland/cli` via (in order of precedence):

- A `.tablelandrc.json`, `.tablelandrc.yml`, or `.tablelandrc.yaml` file.
- A `.tablelandrc` file written in JSON or YAML.
- A `"tableland"` key in a local `package.json` file.

The configuration file will be resolved starting from the current working directory, and searching up the file tree until a config file is (or isn’t) found.

`@tableland/cli` intentionally doesn’t support any kind of global configuration. This is to make sure that when a project is copied to another computer, `@tableland/cli`'s behavior stays the same. Otherwise, `@tableland/cli` wouldn’t be able to guarantee that everybody in a team uses the same consistent settings.

The options you can use in the configuration file are the same as the global cli flag options. Additionally, all of these configuration values can be overridden via environment variables (prefixed with `TBL_`), or via a local `.env` file. See `.env.example` for an example.

A configuration file can also be bootstrapped using the `tableland init` command. This will provide an interactive prompt to setup a config file (you can skip the interactive prompts by using the `--yes` flag). Global cli flags can be used in combination with the `init` command to skip specific questions. For example `tableland init --chain "local-tableland"` will skip the question about default chain, and use `local-tableland` in the output config file.

## Development

Get started with installing and building the project:

```shell
npm install
npm run build
```

## Contributing

PRs accepted.

Small note: If editing the README, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

MIT AND Apache-2.0, © 2021-2023 Tableland Network Contributors
