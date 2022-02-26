import { Database } from "../src/database.ts";
import { Backend } from "./backend.ts";

const DB_URL = new URL("./bench_native.db", import.meta.url);
await Deno.remove(DB_URL).catch(() => {});
const db = new Database(DB_URL);

export default <Backend> {
  name: "sqlite_native",
  execute: (sql, params) => {
    db.execute(sql, ...params as any);
  },
  prepare: (sql) => {
    const stmt = db.prepare(sql);
    return {
      execute: (params) => stmt.execute(...params as any),
      finalize: () => stmt.finalize(),
    };
  },
  query: (sql) => db.queryArray(sql),
  close: () => db.close(),
};
