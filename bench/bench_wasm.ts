import { DB } from "https://deno.land/x/sqlite@v3.0.0/mod.ts";

const db = new DB("bench_wasm.db");

db.query("pragma journal_mode = WAL");
db.query("pragma synchronous = normal");
db.query("pragma temp_store = memory");

db.query(
  "create table test (key integer primary key autoincrement, value text not null)",
);

let loops = 100;
const payload = JSON.stringify({ money: 578, name: "Amatsagu" });
const now = performance.now();

const prep = db.prepareQuery("insert into test (value) values (?)");

while (loops--) {
  prep.execute([payload]);
}

prep.finalize();

console.log(`Done! Took ${performance.now() - now}ms`);

db.close();
