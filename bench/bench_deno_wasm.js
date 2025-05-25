import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import { nextTick } from "https://deno.land/std@0.126.0/node/_next_tick.ts";

const db = new DB(":memory:");

db.query("PRAGMA auto_vacuum = none");
db.query("PRAGMA temp_store = memory");
db.query("PRAGMA locking_mode = exclusive");
db.query("PRAGMA user_version = 100");

const sql = "pragma user_version";

let total = parseInt(Deno.args[0], 10);
const runs = parseInt(Deno.args[1], 10);

function bench(query) {
  const start = performance.now();
  for (let i = 0; i < runs; i++) query();
  const elapsed = Math.floor(performance.now() - start);
  const rate = Math.floor(runs / (elapsed / 1000));
  console.log(`time ${elapsed} ms rate ${rate}`);
  if (--total) nextTick(() => bench(query));
}

const query = db.prepareQuery(sql);
bench(() => query.one());
