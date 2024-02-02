import "dotenv/config";
import chai from "chai";
import { getAccounts, getDatabase } from "../dist/esm/util.js";
import { LocalTableland } from "../dist/esm/main.js";

const expect = chai.expect;
// const localTablelandChainId = 1; // mainnet

describe("Starting a Fork", function () {
  const lt = new LocalTableland({
    silent: true,
    forkUrl: "https://mainnet.infura.io/v3/" + (process.env.INFURA_KEY ?? ""),
    // Adding a specific block number should enable caching
    forkBlockNumber: "17560854",
    forkChainId: "1",
  });
  const accounts = getAccounts(lt);

  // need to allow the whole history to be materialized in the Validator
  this.timeout(60000);
  before(async function () {
    await lt.start();
    await new Promise((resolve) => setTimeout(() => resolve(undefined), 30000));
  });

  after(async function () {
    await lt.shutdown();
  });

  it("has existing mainnet state", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);

    // `key` is a reserved word in sqlite.
    const res = await db
      .prepare("SELECT * FROM pilot_sessions_1_7 LIMIT 10;")
      .all();

    expect(res.success).to.eql(true);
    expect(res.results.length).to.eql(10);

    const sessionOne = res.results[0];
    expect(sessionOne.end_time).to.eql(16141361);
    expect(sessionOne.id).to.eql(1);
    expect(sessionOne.owner).to.eql(
      "0xdd8a5674eca6f1367bd0398d4b931d5b351c0be6"
    );
    expect(sessionOne.pilot_contract).to.eql(null);
    expect(sessionOne.pilot_id).to.eql(null);
    expect(sessionOne.rig_id).to.eql(1018);
    expect(sessionOne.start_time).to.eql(15967006);
  });

  it("creates a table that can be read from", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);

    // `key` is a reserved word in sqlite.
    const res = await db
      .prepare(`CREATE TABLE test_create_read (keyy TEXT, val TEXT);`)
      .all();

    const data = await db.prepare(`SELECT * FROM ${res.meta.txn?.name};`).all();
    expect(data.results).to.eql([]);
  });

  it("updates a table that can be read from", async function () {
    const signer = accounts[1];
    const db = getDatabase(signer);

    // `key` is a reserved word in sqlite.
    const res = await db
      .prepare(`CREATE TABLE test_update_read (keyy TEXT, val TEXT);`)
      .all();

    await db
      .prepare(
        `INSERT INTO ${res.meta.txn?.name} (keyy, val) VALUES ('update', 'works');`
      )
      .all();

    const data = await db.prepare(`SELECT * FROM ${res.meta.txn?.name};`).all();
    expect(data.results).to.eql([{ keyy: "update", val: "works" }]);
  });
});
