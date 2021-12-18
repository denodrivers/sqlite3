import { Database } from "../mod.ts";

await Deno.remove("bug1.db").catch(() => {});
const db = new Database("bug1.db");

db.execute("pragma journal_mode = WAL");
db.execute("pragma synchronous = normal");
db.execute("pragma temp_store = memory");

db.execute("CREATE TABLE IF NOT EXISTS users (name TEXT NOT NULL)");

console.log("start");
for (let i = 0; i < 10_000; i++) {
  db.execute("INSERT INTO users VALUES (?)", "littledivy");
}
console.log("end");

db.close();
