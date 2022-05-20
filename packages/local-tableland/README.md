# End to End Local Tableland script

This is a hacked together Deno script that will get all aspect of Tableland running locally.
This can be useful to test deploying Policy Contracts

## Running

you'll need a the paths to the go-tableland and the eth-tableland repositories to be available as env variables, you'll need docker running, and you need to run the script with some flags. Using `--allow-run` enables subprocesses, and `--allow-env` enables the script to read the env vars

Example:

```
export HARDHAT_DIR=<your path to the eth-tableland repo>
export VALIDATOR_DIR=<your path to the go-tableland repo>/local # <- notice the '/local' !!
deno run --allow-run --allow-env up.js
```

Everything should be running and you are now free to develop your tableland app by connecting to the local validator at http://localhost:8080 and/or the local blockchain at http://localhost:8545

## Notes

 - Make sure to have Docker running before doing this.
 - Keep and eye out for Zombie processes. Killing the Deno process should kill all of the subprocesses, but this kind of script is prone to leaking zombies 🧟
 - There are default values for the registry contract address and the validator wallet address that should match what is in eth-tableland, but you can edit these in `go-tableland/local/config.json`
