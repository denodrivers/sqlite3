import { DB } from "https://deno.land/x/sqlite@v3.0.0/mod.ts";

await Deno.remove("bench_wasm.db").catch(() => {});
await Deno.remove("bench_wasm.db-journal").catch(() => {});

const db = new DB("bench_wasm.db");

db.query("pragma journal_mode = WAL");
db.query("pragma synchronous = normal");
db.query("pragma temp_store = memory");

db.query(
  "CREATE TABLE IF NOT EXISTS Test (key INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL)",
);

let loops = 100;
const payload = JSON.stringify({ money: 578, name: "Amatsagu" });
const now = performance.now();

const prep = db.prepareQuery("INSERT INTO Test (value) VALUES (?)");

while (loops--) {
  prep.execute([payload]);
}

prep.finalize();

console.log(`Done! Took ${performance.now() - now}ms`);

db.close();
