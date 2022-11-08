import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { chalk } from "./chalk.js";
import prompt from "enquirer";
import exampleConfig from "./tableland.config.example.js";

const docsLink = "https://docs.tableland.xyz";
const githubLink = "https://github.com/tablelandnetwork";

export const projectBuilder = async function () {
  const choices = ["No", "Yes"];
  // @ts-ignore https://github.com/enquirer/enquirer/issues/379
  const select = new prompt.Select({
    name: "wtd",
    message: "Welcome to tableland, do you want to create a new project?",
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

  // @ts-ignore https://github.com/enquirer/enquirer/issues/379
  const confirmer = new prompt.Confirm({
    name: "mkdirartifacts",
    message: "Do you want to clone Tableland's Validator repository?",
  });

  const mkdirArtifacts = await confirmer.run();

  if (!mkdirArtifacts) {
    console.log(
      chalk.yellow(`${chalk.bold("Not")} cloning the Validator repo.`)
    );
  } else {
    console.log(
      chalk.yellow(`Creating a ${chalk.bold("tableland-artifacts")} directory.`)
    );
    // make an artifacts directory
    spawnSync("mkdir", ["tableland-artifacts"]);

    console.log(chalk.yellow("Cloning the Validator repository."));
    spawnSync(
      "git",
      ["clone", "git@github.com:tablelandnetwork/go-tableland.git"],
      {
        cwd: "tableland-artifacts",
      }
    );
  }

  console.log(chalk.yellow(`Creating a config file.`));
  // Copy the example config to the new project
  writeFileSync(
    "tableland.config.js",
    "module.exports = " + JSON.stringify(exampleConfig, null, 2)
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
