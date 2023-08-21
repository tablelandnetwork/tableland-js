import { EOL } from "node:os";
import { readFileSync, writeFileSync } from "node:fs";
import prompt from "enquirer";
import { chalk } from "./chalk.js";
import exampleConfig from "./tableland.config.example.js";

const docsLink = "https://docs.tableland.xyz";
const githubLink = "https://github.com/tablelandnetwork/local-tableland";

export const projectBuilder = async function (): Promise<void> {
  const choices = ["No", "Yes"];
  // @ts-expect-error https://github.com/enquirer/enquirer/issues/379
  const select = new prompt.Select({
    name: "wtd",
    message: "Welcome to Tableland, do you want to create a new project?",
    choices: [...choices],
  });

  const shouldCreate = await select.run();
  if (shouldCreate === choices[0]) {
    console.log(
      `${chalk.yellow.bold(
        "OK, if you change your mind run this again anytime!"
      )}
  Don't forget to checkout our docs at ${chalk.cyan(docsLink)}
  and star us on github at ${chalk.cyan(githubLink)}`
    );

    return;
  }

  // check for existing config and bail if it exists
  if (configExists()) {
    console.log(
      `${chalk.red.bold("Config file already exists, nothing to do.")}`
    );
    return;
  }

  console.log(chalk.yellow(`Creating a config file.`));
  // Copy the example config to the new project
  writeFileSync(
    "tableland.config.js",
    [
      "const config = ",
      JSON.stringify(exampleConfig, null, 2),
      ";",
      EOL,
      "export default config;",
    ].join("")
  );

  console.log(
    `${chalk.yellow.bold("Setup is done!")}
  You can start a local Tableland Network by running this command again.
  Use the --help flag to see an overview of usage for this cli.
  Checkout your tableland.config.js file for details.
  Checkout our docs at ${chalk.cyan(docsLink)}
  All the source is on github at ${chalk.cyan(githubLink)}`
  );
};

const configExists = function (): boolean {
  let exists;

  try {
    exists = readFileSync("tableland.config.js");
  } catch (err) {
    // if the file doesn't exist there will be an error, and we can ignore it
  }

  return !(exists == null);
};
