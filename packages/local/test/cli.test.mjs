import chai from "chai";
import shell from "shelljs";

const expect = chai.expect;

describe("Project builder", function () {
  beforeEach(function () {
    // create tmp dir to run the project builder in
    shell.rm("-rf", "tmp");
    shell.mkdir("-p", "tmp");
    shell.cd("tmp");
  });

  afterEach(function () {
    // cleanup
    shell.cd("..");
    shell.rm("-rf", "tmp");
  });

  it("should create a config file", async function () {
    /* eslint-disable node/no-unsupported-features/es-syntax */

    // The file `choose-yes.txt` has the key stokes needed that would
    // go through the prompt and choose yes for the question being asked
    shell.cat("../test/choose-yes.txt").exec("../dist/esm/up.js --init");

    const createdFile = await import("../tmp/tableland.config.js");
    const exampleFile = await import("../dist/esm/tableland.config.example.js");

    expect(createdFile).to.eql(exampleFile);
  });

  it("should do nothing if config file already exists", function () {
    // run the cli to create a file
    shell.cat("../test/choose-yes.txt").exec("../dist/esm/up.js --init");

    const wasCreated = shell.ls("../tmp");
    expect(wasCreated[0]).to.eql("tableland.config.js");

    // run the cli again and it should fail because config exists already
    const cliOut = shell
      .cat("../test/choose-yes.txt")
      .exec("../dist/esm/up.js --init");

    expect(cliOut.toString()).to.match(
      /Config file already exists, nothing to do/
    );
  });

  it("should do nothing if user says not to", async function () {
    /* eslint-disable node/no-unsupported-features/es-syntax */
    const cliOut = shell
      .cat("../test/choose-no.txt")
      .exec("../dist/esm/up.js --init");

    expect(cliOut.toString()).to.match(/run this again anytime/);

    await expect(import("../tmp/tableland.config.js")).to.be.rejectedWith(
      "Cannot find module"
    );
  });
});
