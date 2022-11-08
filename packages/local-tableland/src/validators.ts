import { spawn, spawnSync, ChildProcess } from "node:child_process";
import { join, resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { logSync } from "./util.js";

// NOTE: We are creating this file in the prebuild.sh script so that we can support cjs and esm
import { getDirname } from "./get-dirname.js";
const _dirname = getDirname();

// TODO: should this be a per instance value?
// store the Validator config file in memory, so we can restore it during cleanup
let ORIGINAL_VALIDATOR_CONFIG: string | undefined;

// ref for all possilbe values of process.platform
const platformMap = {
  aix: "",
  darwin: "",
  freebsd: "",
  linux: "",
  openbsd: "",
  netbsd: "",
  sunos: "",
  win32: "",
  cygwin: "",
  android: "",
  haiku: "",
};

// TODO: what combos do we want to support here? Seems like 5 or 6 might cover pretty much everyone.
const archMap = {
  arm: platformMap, // TODO: not supported yet,
  arm64: platformMap, // TODO: not supported yet,
  ia32: platformMap, // TODO: not supported yet,
  mips: platformMap, // TODO: not supported yet,
  mipsel: platformMap, // TODO: not supported yet,
  ppc: platformMap, // TODO: not supported yet,
  ppc64: platformMap, // TODO: not supported yet,
  s390: platformMap, // TODO: not supported yet,
  s390x: platformMap, // TODO: not supported yet,

  // a.k.a. amd64
  x64: {
    aix: "",
    darwin: "darwin",
    freebsd: "linux",
    linux: "linux",
    openbsd: "linux",
    netbsd: "linux",
    sunos: "",
    win32: "windows",
    cygwin: "windows",
    android: "",
    haiku: "",
  },
};

class ValidatorPkg {
  process?: ChildProcess;
  validatorDir = resolve(_dirname, "..", "..", "validator");

  start() {
    const arch = archMap[process.arch];
    if (!arch) {
      throw new Error(`cannot start with: arch ${process.arch}`);
    }

    const binName = arch[process.platform];
    if (!binName) {
      throw new Error(
        `cannot start with: arch ${process.arch}, platform ${process.platform}`
      );
    }

    this.process = spawn(
      `${resolve(this.validatorDir, "bin", binName)}`,
      ["--dir", this.validatorDir],
      {
        detached: true,
      }
    );
  }

  // fully nuke the database
  cleanup() {
    spawnSync("rm", ["-rf", resolve(this.validatorDir, "backups")]);

    const dbFiles = [
      resolve(this.validatorDir, "database.db"),
      resolve(this.validatorDir, "metrics.db"),
    ];
    for (const filepath of dbFiles) {
      spawnSync("rm", ["-f", filepath]);
    }
  }
}

class ValidatorDev {
  validatorDir: string;
  process?: ChildProcess;

  constructor(validatorPath?: string) {
    if (!validatorPath) throw new Error("must supply path to validator");
    this.validatorDir = validatorPath;
  }

  start() {
    // Add an empty .env file to the validator. The Validator expects this to exist,
    // but doesn't need any of the values when running a local instance
    writeFileSync(
      join(this.validatorDir, "docker", "local", "api", ".env_validator"),
      " "
    );

    // Add the registry address to the Validator config
    // TODO: when https://github.com/tablelandnetwork/go-tableland/issues/317 is
    //       resolved we may be able to refactor alot of this
    const configFilePath = join(
      this.validatorDir,
      "docker",
      "local",
      "api",
      "config.json"
    );
    const configFileStr = readFileSync(configFilePath).toString();
    const validatorConfig = JSON.parse(configFileStr);

    // save the validator config state before this script modifies it
    ORIGINAL_VALIDATOR_CONFIG = JSON.stringify(validatorConfig, null, 2);

    // TODO: this could be parsed out of the deploy process, but since
    //       it's always the same address just hardcoding it here
    validatorConfig.Chains[0].Registry.ContractAddress =
      "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";

    writeFileSync(configFilePath, JSON.stringify(validatorConfig, null, 2));

    // start the validator
    this.process = spawn("make", ["local-up"], {
      detached: true,
      cwd: join(this.validatorDir, "docker"),
    });
  }

  cleanup() {
    logSync(spawnSync("docker", ["container", "prune", "-f"]));

    spawnSync("docker", ["image", "rm", "docker_api", "-f"]);
    spawnSync("docker", ["volume", "prune", "-f"]);

    const dbFiles = [
      join(this.validatorDir, "docker", "local", "api", "database.db"),
      join(this.validatorDir, "docker", "local", "api", "database.db-shm"),
      join(this.validatorDir, "docker", "local", "api", "database.db-wal"),
    ];

    for (const filepath of dbFiles) {
      spawnSync("rm", ["-f", filepath]);
    }

    // reset the Validator config file that is modified on startup
    if (ORIGINAL_VALIDATOR_CONFIG) {
      const configFilePath = join(
        this.validatorDir,
        "docker",
        "local",
        "api",
        "config.json"
      );
      writeFileSync(configFilePath, ORIGINAL_VALIDATOR_CONFIG);
    }
  }
}

export { ValidatorDev, ValidatorPkg };
