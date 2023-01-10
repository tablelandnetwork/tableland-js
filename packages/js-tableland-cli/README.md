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
- [Config](#config)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

# Background

An experimental Tableland command line tool.

# Usage

```bash
tableland <command>

Commands:
  tableland chains             List information about supported chains
  tableland controller <sub>   Get, set, and lock the controller contract for a
                               given table
  tableland create [schema]    Create a new table
  tableland info <name>        Get info about a given table by name
  tableland init               Create config file                   [aliases: i]
  tableland list [address]     List tables by address
  tableland read [statement]   Run a read-only query against a remote table
                                                          [aliases: r, query, q]
  tableland receipt <hash>     Get the receipt of a chain transaction to know if
                               it was executed, and the execution details
  tableland schema <name>      Get info about a given table schema
  tableland write [statement]  Run a mutating SQL statement against a remote
                               table                        [aliases: w, run, r]
  tableland shell [statement]  Interact with tableland via an interactive shell
                               environment                      [aliases: s, sh]

Options:
      --help         Show help                                         [boolean]
      --version      Show version number                               [boolean]
  -k, --privateKey   Private key string                                 [string]
  -c, --chain        The EVM chain to target      [string] [default: "maticmum"]
  -p, --providerUrl  JSON RPC API provider URL. (e.g., https://eth-rinkeby.alche
                     myapi.io/v2/123abc123a...)                         [string]
```

# Install

You can install via npm.

```
npm install -g @tableland/cli
```

# Config

`@tableland/cli` uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for configuration file support. This means you can configure `@tableland/cli` via (in order of precedence):

- A `.tablelandrc.json`, `.tablelandrc.yml`, or `.tablelandrc.yaml` file.
- A `.tablelandrc` file written in JSON or YAML.
- A `"tableland"` key in a local `package.json` file.

The configuration file will be resolved starting from the current working directory, and searching up the file tree until a config file is (or isn’t) found.

`@tableland/cli` intentionally doesn’t support any kind of global configuration. This is to make sure that when a project is copied to another computer, `@tableland/cli`'s behavior stays the same. Otherwise, `@tableland/cli` wouldn’t be able to guarantee that everybody in a team uses the same consistent settings.

The options you can use in the configuration file are the same as the global cli flag options. Additionally, all of these configuration values can be overriden via environement variables (prefixed with `TBL_`), or via a local `.env` file. See `.env.example` for an example.

A configuration file can also be bootstrapped using the `tableland init` command. This will provide an interactive prompt to setup a config file (you can skip the interactive prompts by using the `--yes` flag). Global cli flags can be used in combination with the `init` command to skip specific questions. For example `tableland init --chain "maticmum"` will skip the question about default chain, and use `maticmum` in the output config file.

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
