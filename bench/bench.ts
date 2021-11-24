import {
  cstr,
  sqlite3_bind_text,
  sqlite3_close_v2,
  sqlite3_exec,
  sqlite3_finalize,
  sqlite3_open_v2,
  sqlite3_prepare_v3,
  sqlite3_reset,
  sqlite3_step,
} from "../mod.ts";

await Deno.remove("bench_test.db").catch(() => {});

const db = sqlite3_open_v2("bench_test.db");

sqlite3_exec(db, "pragma journal_mode = WAL");
sqlite3_exec(db, "pragma synchronous = normal");
sqlite3_exec(db, "pragma temp_store = memory");

sqlite3_exec(
  db,
  "create table test (key integer primary key autoincrement, value text not null)",
);

let loops = 100;
const payload = cstr("hello world");
const now = performance.now();

const stmt = sqlite3_prepare_v3(db, "insert into test (value) values (?)");

while (loops--) {
  sqlite3_bind_text(db, stmt, 1, payload, payload.length);
  sqlite3_step(db, stmt);
  sqlite3_reset(db, stmt);
}

sqlite3_finalize(db, stmt);

console.log(`Done! Took ${performance.now() - now}ms`);

sqlite3_close_v2(db);
