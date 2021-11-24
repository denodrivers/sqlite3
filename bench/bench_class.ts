import { Database } from "../src/database.ts";

await Deno.remove("bench_class.db").catch(() => {});

const db = new Database("bench_class.db");

db.execute("pragma journal_mode = WAL");
db.execute("pragma synchronous = normal");
db.execute("pragma temp_store = memory");

db.execute(
  "create table test (key integer primary key autoincrement, value text not null)",
);

let loops = 100;
const payload = "hello world";
const now = performance.now();

const prep = db.prepare("insert into test (value) values (?)");

while (loops--) {
  prep.execute(payload);
}

prep.finalize();

console.log(`Done! Took ${performance.now() - now}ms`);

db.close();
