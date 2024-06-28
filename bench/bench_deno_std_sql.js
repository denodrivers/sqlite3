import { SqliteClient } from "../std_sql.ts";

const db = new SqliteClient(":memory:", { unsafeConcurrency: true });

await db.connect();

await db.execute("PRAGMA auto_vacuum = none");
await db.execute("PRAGMA temp_store = memory");
await db.execute("PRAGMA locking_mode = exclusive");
await db.execute("PRAGMA user_version = 100");

const sql = "pragma user_version";

let total = parseInt(Deno.args[0], 10);
const runs = parseInt(Deno.args[1], 10);

async function bench(query) {
  const start = performance.now();
  for (let i = 0; i < runs; i++) await query();
  const elapsed = Math.floor(performance.now() - start);
  const rate = Math.floor(runs / (elapsed / 1000));
  console.log(`time ${elapsed} ms rate ${rate}`);
  if (--total) bench(query);
}

const query = db.prepare(sql);
bench(() => query.queryOne());
