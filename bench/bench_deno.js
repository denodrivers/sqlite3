import { Database } from "../mod.ts";

const db = new Database(":memory:", { unsafeConcurrency: true });

db.run("PRAGMA auto_vacuum = none");
db.run("PRAGMA temp_store = memory");
db.run("PRAGMA locking_mode = exclusive");
db.run("PRAGMA user_version = 100");

const sql = "pragma user_version";

let total = parseInt(Deno.args[0], 10);
const runs = parseInt(Deno.args[1], 10);

function bench(query) {
  const start = performance.now();
  for (let i = 0; i < runs; i++) query();
  const elapsed = Math.floor(performance.now() - start);
  const rate = Math.floor(runs / (elapsed / 1000));
  console.log(`time ${elapsed} ms rate ${rate}`);
  if (--total) bench(query);
}

const query = db.prepare(sql);
bench(() => query.get());
