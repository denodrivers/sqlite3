import { DatabaseSync as Database } from "node:sqlite";

const db = new Database(":memory:");

db.exec("PRAGMA auto_vacuum = none");
db.exec("PRAGMA temp_store = memory");
db.exec("PRAGMA locking_mode = exclusive");
db.exec("PRAGMA user_version = 100");

const sql = "pragma user_version";

let total = parseInt(process.argv[2], 10);
const execs = parseInt(process.argv[3], 10);

function bench(query) {
  const start = performance.now();
  for (let i = 0; i < execs; i++) query();
  const elapsed = Math.floor(performance.now() - start);
  const rate = Math.floor(execs / (elapsed / 1000));
  console.log(`time ${elapsed} ms rate ${rate}`);
  if (--total) bench(query);
}

const query = db.prepare(sql);
bench(() => query.get());
