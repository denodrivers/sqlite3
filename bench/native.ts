import { Database } from "../src/database.ts";
import { Backend } from "./backend.ts";

const DB_URL = new URL("./bench_native.db", import.meta.url);
await Deno.remove(DB_URL).catch(() => {});
const db = new Database(DB_URL);

export default <Backend> {
  name: "sqlite_native",
  execute: (sql, params) => {
    db.execute(sql, ...params);
  },
  prepare: (sql) => {
    const prep = db.prepare(sql);
    return {
      execute: (params) => prep.execute(...params),
      finalize: () => prep.finalize(),
    };
  },
  query: (sql) => db.queryArray(sql),
  close: () => db.close(),
};
