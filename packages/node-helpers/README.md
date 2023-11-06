# @tableland/node-helpers

[![Review](https://github.com/tablelandnetwork/tableland-js/actions/workflows/review.yml/badge.svg)](https://github.com/tablelandnetwork/tableland-js/actions/workflows/review.yml)
[![Test](https://github.com/tablelandnetwork/tableland-js/actions/workflows/test.yml/badge.svg)](https://github.com/tablelandnetwork/tableland-js/actions/workflows/test.yml)
[![License: MIT AND Apache-2.0](https://img.shields.io/badge/License-MIT%20AND%20Apache--2.0-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftablelandnetwork%2Ftableland-js%2Fmain%2Fpackages%2Fnode-helpers%2Fpackage.json&query=%24.version&label=Version)](./package.json)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg)](https://github.com/RichardLitt/standard-readme)

> Helpers for the `@tableland/sdk` in a Node.js environment

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Background

This package provides helpers for the `@tableland/sdk` in a Node.js environment. It exports a single `jsonFileAliases` method takes a path and optional `async` flag for asynchronous behavior, and it returns a function that can be used as the `aliases` option for the `Database` class. It creates an `AliasesNameMap`, which exposes `read()` and `write()` methods that will store table aliases mapped to their unique table uuid (`prefix_chainId_tableId`). The path passed to `jsonFileAliases` can be one of:

- A path to an _existing_ JSON file (e.g., `./tableland.aliases.json`).
- A path to a directory but with a user-defined filename that doesn't exist yet but should be created (e.g., `/path/to/custom-filename.json`).
- A path to a directory with _no_ filename specified, which will default to creating a file named `tableland.aliases.json` in that directory (e.g., `./`).

Once the `Database` class is instantiated with the `aliases` option, all database queries will let you use the table's alias instead of the full table uuid, which makes it easier to write SQL statements.

## Install

You can install via npm.

```
npm install @tableland/node-helpers
```

Or yarn:

```bash
yarn add @tableland/node-helpers
```

## Usage

Full library documentation is [available on our docs site](https://docs.tableland.xyz/sdk/database/aliases). You can import the `jsonFileAliases` function from the package and pass it to the SDK's `Database` class.

```js
import { jsonFileAliases } from "@tableland/node-helpers";
import { Database } from "@tableland/sdk";

const aliases = jsonFileAliases("/path/to/tableland.aliases.json");

const db = new Database({
  aliases,
});
```

To use asynchronous file operations, you can set the `async` flag to `true`. By default, no flag is required and will use synchronous file operations (i.e., set to `false`).

```js
const aliases = await jsonFileAliases("./tableland.aliases.json", true);
```

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
