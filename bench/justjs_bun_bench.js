import { constants, Database } from "bun:sqlite";

const defaultFlags = constants.SQLITE_OPEN_READWRITE |
  constants.SQLITE_OPEN_PRIVATECACHE |
  constants.SQLITE_OPEN_NOMUTEX |
  constants.SQLITE_OPEN_CREATE;
const db = Database.open(":memory:", defaultFlags);

db.run("PRAGMA auto_vacuum = none");
db.run("PRAGMA temp_store = memory");
db.run("PRAGMA locking_mode = exclusive");
db.run("PRAGMA user_version = 100");

let total = parseInt(process.argv[2], 10);
const runs = parseInt(process.argv[3], 10);

function bench(query) {
  const start = Date.now();
  for (let i = 0; i < runs; i++) query();
  const elapsed = Date.now() - start;
  const rate = Math.floor(runs / (elapsed / 1000));
  console.log(`time ${elapsed} ms rate ${rate}`);
  if (--total) process.nextTick(() => bench(query));
}

const query = db.prepare("pragma user_version");
bench(() => query.get());
