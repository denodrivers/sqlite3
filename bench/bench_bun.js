import process from "node:process";
import { Database } from "bun:sqlite";

// Unsafe concurrency is default.
const db = Database.open(":memory:");

db.exec("PRAGMA auto_vacuum = none");
db.exec("PRAGMA temp_store = memory");
db.exec("PRAGMA locking_mode = exclusive");
db.exec("PRAGMA user_version = 100");

const sql = "pragma user_version";

function createQuery(sql) {
  return db.prepare(sql);
}

let total = parseInt(process.argv[2], 10);
const runs = parseInt(process.argv[3], 10);

function bench(query) {
  const start = performance.now();
  for (let i = 0; i < runs; i++) query();
  const elapsed = Math.floor(performance.now() - start);
  const rate = Math.floor(runs / (elapsed / 1000));
  console.log(`time ${elapsed} ms rate ${rate}`);
  if (--total) process.nextTick(() => bench(query));
}

const query = createQuery(sql);
bench(() => query.get());
