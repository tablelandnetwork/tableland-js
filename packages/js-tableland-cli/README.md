# @tableland/cli

[![GitHub license](https://img.shields.io/github/license/tablelandnetwork/js-tableland-cli.svg)](./LICENSE)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/tablelandnetwork/js-tableland-cli.svg)](./package.json)
[![Release](https://img.shields.io/github/release/tablelandnetwork/js-tableland-cli.svg)](https://github.com/tablelandnetwork/js-tableland-cli/releases/latest)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg)](https://github.com/RichardLitt/standard-readme)

> Tableland command line tools

# Table of Contents

- [Background](#background)
- [Usage](#usage)
- [Install](#install)
- [Development](#development)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

# Background

This is the experimental Tableland command line tools.
This is the first pass, and is subject to wild changes without notice!

# Usage

```bash
tableland [command]

Commands:
  tableland create <statement>              Run a query against a remote table
  [description] [alchemy] [infura]
  tableland info <id>                       Get info about a given table by id.
  tableland jwt                             Create a signed JWT token
  tableland list [controller]               List tables by controller
  tableland query <statement>               Run a query against a remote table
  [description]

Options:
      --help        Show help                                          [boolean]
      --version     Show version number                                [boolean]
  -k, --privateKey  Private key string                       [string] [required]
  -h, --host        Remote API host
                         [string] [default: "https://testnet.tableland.network"]
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

MIT © 2022 Tableland Network Contributors
