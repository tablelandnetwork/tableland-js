# Local Tableland

This repo contains multiple scripts that will get all aspect of Tableland running locally, and potentialy aid in development of Tableland.
Potential uses include:

- running a local instance of tableland for an app you are developing to connect to.
- Running end to end tests to see if changes to one of the SDK, Smart Contract, and/or Validator will have unexpected consequences.
- Exploring, writing, and debuggin Policy Contracts.

## Running a local Tableland Validator

setup steps:

- the paths to the go-tableland and the evm-tableland repositories need to be available as env variables, VALIDATOR_DIR, and HARDHAT_DIR respectively.
- you'll need docker running
- finally run the Deno `up.ts` script. This is a Deno script that needs to runs with the `--allow-run` flag, and the `--allow-env` flag. **Warning** these flags will cause Deno to break out of the sandbox and read all of the available env vars.

Example:

```
export HARDHAT_DIR=<your path to the evm-tableland repo>
export VALIDATOR_DIR=<your path to the go-tableland repo>/docker # <- notice the '/docker' !!
deno run --allow-run --allow-env up.ts
```

If this repo has been cloned in the same directory as evm-tableland and go-tableland, you can avoid setting the env vars and just do `npm run up`

Now everything should be running and you are now free to develop your tableland app by connecting to the local validator at http://localhost:8080 and/or the local blockchain at http://localhost:8545, or run tests, or whatever.

## Running end-to-end tests

First get a local Tableland Validator running as explained above, then you can do `npm test`. That's it! You should see passing tests.

## Tips for how to use these scripts when building Tableland

Make sure you have go-tableland, evm-tableland, and js-tableland repos cloned locally.
If developing evm-tableland, js-tableland, or any app that uses js-tableland via npm you will want to make use of the `npm link` command.
It's a good idea to get the [docs](https://docs.npmjs.com/cli/v6/commands/npm-link) for that if you haven't already.
For an example, let's consider the case of wanting to test if updates to the SDK work with the Validator and Smart Contract
With your changes to the SDK/SC in place you could do `npm link ../js-tableland ../evm-tableland` then `npm test`. This will run the end-to-end tests against which ever changes you've made locally.

## Notes

- Keep and eye out for Zombie processes. Killing the Deno process should kill all of the subprocesses, but this kind of script is prone to leaking zombies 🧟
- There are default values for the registry contract address and the validator wallet address that should match what is in evm-tableland, but you can edit these in `go-tableland/local/config-dev.json`. If you have any issues with the Validator a good first place to check is the config-dev.json file.
