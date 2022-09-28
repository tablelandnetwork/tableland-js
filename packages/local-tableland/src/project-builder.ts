import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { chalk } from "./chalk.js";
import prompt from "enquirer";
import sentencer from "sentencer";
import exampleConfig from "./tableland.config.example.js";

const docsLink = "https://docs.tableland.xyz";
const githubLink = "https://github.com/tablelandnetwork";

export const projectBuilder = async function () {
  const choices = [
    "No, I don't want to create a project right now",
    "Yes, and I want to control everything each step of the way",
    "Yes, but setup everything for me and stop asking me questions",
  ];
  // @ts-ignore https://github.com/enquirer/enquirer/issues/379
  const select = new prompt.Select({
    name: "wtd",
    message:
      "Couldn't find an existing Tableland project, do you want to create a new project?",
    choices: [...choices],
  });

  const shouldCreate = await select.run();
  if (shouldCreate === choices[0]) {
    console.log(
      `${chalk.yellow.bold(sentencer.make("OK, have a wonderful {{ noun }}!"))}
  Don't forget to checkout our docs at ${chalk.cyan(docsLink)}
  and star us on github at ${chalk.cyan(githubLink)}`
    );
    return;
  }

  let mkdirArtifacts = true;
  if (shouldCreate === choices[1]) {
    // @ts-ignore https://github.com/enquirer/enquirer/issues/379
    const confirmer = new prompt.Confirm({
      name: "mkdirartifacts",
      message:
        "Is it ok to create a directory for Tableland's Validator and Registry repositories?",
    });

    mkdirArtifacts = await confirmer.run();
  }

  if (!mkdirArtifacts) {
    console.log(
      chalk.yellow(
        `${chalk.bold(
          "Not"
        )} creating any directories or cloning any repositories.`
      )
    );
  } else {
    console.log(
      chalk.yellow(`Creating a ${chalk.bold("tableland-artifacts")} directory.`)
    );
    // make an artifacts directory
    spawnSync("mkdir", ["tableland-artifacts"]);

    let gitCloneValidator = true;
    if (shouldCreate === choices[1]) {
      // @ts-ignore https://github.com/enquirer/enquirer/issues/379
      const confirmer = new prompt.Confirm({
        name: "gitcloneval",
        message: "Is it ok to use git to clone the Validator repository?",
      });

      gitCloneValidator = await confirmer.run();
    }

    if (!gitCloneValidator) {
      console.log(
        chalk.yellow(`${chalk.bold("Not")} cloning the Validator repository.`)
      );
    } else {
      console.log(chalk.yellow("Cloning the Validator repository."));
      spawnSync(
        "git",
        ["clone", "git@github.com:tablelandnetwork/go-tableland.git"],
        {
          cwd: "tableland-artifacts",
        }
      );
    }

    let gitCloneEvm = true;
    if (shouldCreate === choices[1]) {
      // @ts-ignore https://github.com/enquirer/enquirer/issues/379
      const confirmer = new prompt.Confirm({
        name: "gitcloneevm",
        message:
          "Is it ok to use git to clone the Registry contract repository?",
      });

      gitCloneEvm = await confirmer.run();
    }

    if (!gitCloneEvm) {
      console.log(
        chalk.yellow(`${chalk.bold("Not")} cloning the Registry repository.`)
      );
    } else {
      console.log(chalk.yellow("Cloning the Registry repository."));
      // clone the validator
      spawnSync(
        "git",
        ["clone", "git@github.com:tablelandnetwork/evm-tableland.git"],
        {
          cwd: "tableland-artifacts",
        }
      );
    }
  }

  let createConfig = true;
  if (shouldCreate === choices[1]) {
    // @ts-ignore https://github.com/enquirer/enquirer/issues/379
    const confirmer = new prompt.Confirm({
      name: "gitcloneevm",
      message: "Is it ok to create a config file?",
    });

    createConfig = await confirmer.run();
  }

  if (!createConfig) {
    console.log(chalk.yellow(`${chalk.bold("Not")} creating a config file.`));
  } else {
    console.log(chalk.yellow(`Creating a config file.`));
    // Copy the example config to the new project
    writeFileSync(
      "tableland.config.js",
      "module.exports = " + JSON.stringify(exampleConfig, null, 2)
    );
  }

  console.log(
    `${chalk.yellow.bold("Setup is done!")}
  If you didn't skip any steps you you can start a local Tableland Network by running this command again.
  Use the --help flag to see an overview of usage for this cli.
  If you skipped some of the steps, edit your tableland.config.js file before starting.
  Checkout our docs at ${chalk.cyan(docsLink)}
  All the source is on github at ${chalk.cyan(githubLink)}`
  );
};
