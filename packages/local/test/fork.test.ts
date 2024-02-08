import "dotenv/config";
import chai from "chai";
import { getAccounts, getDatabase } from "../dist/esm/util.js";
import { LocalTableland } from "../dist/esm/main.js";
import { TEST_TIMEOUT_FACTOR } from "./setup.js";

const expect = chai.expect;
// const localTablelandChainId = 1; // mainnet

describe("Starting a Fork", function () {
  this.timeout(30000 * TEST_TIMEOUT_FACTOR);

  describe("mainnet", function () {
    const lt = new LocalTableland({
      silent: true,
      forkUrl: "https://mainnet.infura.io/v3/" + (process.env.INFURA_KEY ?? ""),
      // Adding a specific block number should enable caching
      forkBlockNumber: "17560854",
      forkChainId: "1",
    });
    const accounts = getAccounts(lt);

    before(async function () {
      // need to allow the history to be materialized in the Validator
      this.timeout(200000 * TEST_TIMEOUT_FACTOR);

      await lt.start();
      await new Promise((resolve) =>
        setTimeout(() => resolve(undefined), 30000)
      );
    });

    after(async function () {
      await lt.shutdown();
    });

    it("has existing state", async function () {
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

      const data = await db
        .prepare(`SELECT * FROM ${res.meta.txn?.name};`)
        .all();
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

      const data = await db
        .prepare(`SELECT * FROM ${res.meta.txn?.name};`)
        .all();
      expect(data.results).to.eql([{ keyy: "update", val: "works" }]);
    });
  });

  describe("polygon", function () {
    const lt = new LocalTableland({
      silent: true,
      forkUrl:
        "https://polygon-mainnet.infura.io/v3/" +
        (process.env.INFURA_KEY ?? ""),
      // Adding a specific block number should enable caching
      forkBlockNumber: "53054758",
      forkChainId: "137",
    });
    const accounts = getAccounts(lt);

    before(async function () {
      // need to allow the history to be materialized in the Validator
      this.timeout(200000 * TEST_TIMEOUT_FACTOR);

      await lt.start();
      await new Promise((resolve) =>
        setTimeout(() => resolve(undefined), 60000)
      );
    });

    after(async function () {
      await lt.shutdown();
    });

    it("has existing state", async function () {
      const signer = accounts[1];
      const db = getDatabase(signer);

      // `key` is a reserved word in sqlite.
      const res = await db
        .prepare("SELECT * FROM brick_battles_137_81 LIMIT 10;")
        .all();

      expect(res.success).to.eql(true);
      expect(res.results.length).to.eql(2);

      const battleOne = res.results[0];

      expect(battleOne.amount).to.eql(null);
      expect(battleOne.id).to.eql(0);
      expect(battleOne.players).to.eql("0");
      expect(battleOne.state).to.eql(0);
      expect(battleOne.streamId).to.eql(
        "0x43e941d849fe17d00a8787bc0652a2d0c3578553/match/0"
      );
    });

    it("creates a table that can be read from", async function () {
      const signer = accounts[1];
      const db = getDatabase(signer);

      // `key` is a reserved word in sqlite.
      const res = await db
        .prepare(`CREATE TABLE test_create_read (keyy TEXT, val TEXT);`)
        .all();

      const data = await db
        .prepare(`SELECT * FROM ${res.meta.txn?.name};`)
        .all();
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

      const data = await db
        .prepare(`SELECT * FROM ${res.meta.txn?.name};`)
        .all();
      expect(data.results).to.eql([{ keyy: "update", val: "works" }]);
    });
  });

  describe("optimism", function () {
    const lt = new LocalTableland({
      silent: true,
      forkUrl:
        "https://optimism-mainnet.infura.io/v3/" +
        (process.env.INFURA_KEY ?? ""),
      // Adding a specific block number should enable caching
      forkBlockNumber: "115779462",
      forkChainId: "10",
    });
    const accounts = getAccounts(lt);

    before(async function () {
      // need to allow the history to be materialized in the Validator
      this.timeout(200000 * TEST_TIMEOUT_FACTOR);

      await lt.start();
      await new Promise((resolve) =>
        setTimeout(() => resolve(undefined), 60000)
      );
    });

    after(async function () {
      await lt.shutdown();
    });

    it("has existing state", async function () {
      const signer = accounts[1];
      const db = getDatabase(signer);

      // `key` is a reserved word in sqlite.
      const res = await db
        .prepare("select * from layers_10_10 limit 10;")
        .all();

      expect(res.success).to.eql(true);
      expect(res.results.length).to.eql(10);

      const layerOne = res.results[0];

      expect(layerOne.cid).to.eql(
        "ipfs://bafybeiepkpr4g4jzqyy6cjaegcxtmngyjqnf4vhekfrhadqappl5nuxvli/Airelights/Airframe/Cloudlifter_Dawn_Varray.png"
      );
      expect(layerOne.fleet).to.eql("Airelights");
      expect(layerOne.id).to.eql(1);
      expect(layerOne.position).to.eql(2);
      expect(layerOne.rig_attributes_value).to.eql("Dawn Varray");
    });

    it("creates a table that can be read from", async function () {
      const signer = accounts[1];
      const db = getDatabase(signer);

      // `key` is a reserved word in sqlite.
      const res = await db
        .prepare(`CREATE TABLE test_create_read (keyy TEXT, val TEXT);`)
        .all();

      const data = await db
        .prepare(`SELECT * FROM ${res.meta.txn?.name};`)
        .all();
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

      const data = await db
        .prepare(`SELECT * FROM ${res.meta.txn?.name};`)
        .all();
      expect(data.results).to.eql([{ keyy: "update", val: "works" }]);
    });
  });

  describe("arbitrum", function () {
    const lt = new LocalTableland({
      silent: true,
      forkUrl:
        "https://arbitrum-mainnet.infura.io/v3/" +
        (process.env.INFURA_KEY ?? ""),
      // Adding a specific block number should enable caching
      forkBlockNumber: "177762062",
      forkChainId: "42161",
    });
    const accounts = getAccounts(lt);

    before(async function () {
      // need to allow the history to be materialized in the Validator
      this.timeout(200000 * TEST_TIMEOUT_FACTOR);

      await lt.start();
      await new Promise((resolve) =>
        setTimeout(() => resolve(undefined), 60000)
      );
    });

    after(async function () {
      await lt.shutdown();
    });

    it("has existing state", async function () {
      const signer = accounts[1];
      const db = getDatabase(signer);

      // `key` is a reserved word in sqlite.
      const res = await db
        .prepare("select * from lookups_42161_10 limit 10;")
        .all();

      expect(res.success).to.eql(true);
      expect(res.results.length).to.eql(1);

      const lookupOne = res.results[0];

      expect(lookupOne.animation_base_url).to.eql(
        "https://rigs.tableland.xyz/"
      );
      expect(lookupOne.image_full_alpha_name).to.eql("image_full_alpha.png");
      expect(lookupOne.image_full_name).to.eql("image_full.png");
      expect(lookupOne.image_medium_alpha_name).to.eql(
        "image_medium_alpha.png"
      );
      expect(lookupOne.image_medium_name).to.eql("image_medium.png");
      expect(lookupOne.image_thumb_alpha_name).to.eql("image_thumb_alpha.png");
      expect(lookupOne.image_thumb_name).to.eql("image_thumb.png");
      expect(lookupOne.layers_cid).to.eql(
        "bafybeiblrxikxpcwanbgs5g5j6yftmuhdfmesy4rohbhewn2gype3sqgue"
      );
      expect(lookupOne.renders_cid).to.eql(
        "bafybeidpnfh2zc6esvou3kfhhvxmy2qrmngrqczj7adnuygjsh3ulrrfeu"
      );
    });

    it("creates a table that can be read from", async function () {
      const signer = accounts[1];
      const db = getDatabase(signer);

      // `key` is a reserved word in sqlite.
      const res = await db
        .prepare(`CREATE TABLE test_create_read (keyy TEXT, val TEXT);`)
        .all();

      const data = await db
        .prepare(`SELECT * FROM ${res.meta.txn?.name};`)
        .all();
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

      const data = await db
        .prepare(`SELECT * FROM ${res.meta.txn?.name};`)
        .all();
      expect(data.results).to.eql([{ keyy: "update", val: "works" }]);
    });
  });

  describe.skip("arbitrum-nova", function () {
    const lt = new LocalTableland({
      silent: true,
      // TODO: infura does not support Nova afaict
      forkUrl:
        "https://arbitrum-nova.infura.io/v3/" + (process.env.INFURA_KEY ?? ""),
      // Adding a specific block number should enable caching
      forkBlockNumber: "45000000",
      forkChainId: "42170",
    });
    const accounts = getAccounts(lt);

    before(async function () {
      // need to allow the history to be materialized in the Validator
      this.timeout(90000 * TEST_TIMEOUT_FACTOR);

      await lt.start();
      await new Promise((resolve) =>
        setTimeout(() => resolve(undefined), 60000)
      );
    });

    after(async function () {
      await lt.shutdown();
    });

    it("has existing state", async function () {
      const signer = accounts[1];
      const db = getDatabase(signer);

      // `key` is a reserved word in sqlite.
      const res = await db
        .prepare("select * from lookups_42161_10 limit 10;")
        .all();

      expect(res.success).to.eql(true);
      expect(res.results.length).to.eql(1);

      const lookupOne = res.results[0];

      expect(lookupOne.animation_base_url).to.eql(
        "https://rigs.tableland.xyz/"
      );
      expect(lookupOne.image_full_alpha_name).to.eql("image_full_alpha.png");
      expect(lookupOne.image_full_name).to.eql("image_full.png");
      expect(lookupOne.image_medium_alpha_name).to.eql(
        "image_medium_alpha.png"
      );
      expect(lookupOne.image_medium_name).to.eql("image_medium.png");
      expect(lookupOne.image_thumb_alpha_name).to.eql("image_thumb_alpha.png");
      expect(lookupOne.image_thumb_name).to.eql("image_thumb.png");
      expect(lookupOne.layers_cid).to.eql(
        "bafybeiblrxikxpcwanbgs5g5j6yftmuhdfmesy4rohbhewn2gype3sqgue"
      );
      expect(lookupOne.renders_cid).to.eql(
        "bafybeidpnfh2zc6esvou3kfhhvxmy2qrmngrqczj7adnuygjsh3ulrrfeu"
      );
    });

    it("creates a table that can be read from", async function () {
      const signer = accounts[1];
      const db = getDatabase(signer);

      // `key` is a reserved word in sqlite.
      const res = await db
        .prepare(`CREATE TABLE test_create_read (keyy TEXT, val TEXT);`)
        .all();

      const data = await db
        .prepare(`SELECT * FROM ${res.meta.txn?.name};`)
        .all();
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

      const data = await db
        .prepare(`SELECT * FROM ${res.meta.txn?.name};`)
        .all();
      expect(data.results).to.eql([{ keyy: "update", val: "works" }]);
    });
  });
});
