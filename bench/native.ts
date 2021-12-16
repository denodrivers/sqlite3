import { Database } from "../src/database.ts";
import { Backend } from "./backend.ts";

await Deno.remove("bench_class.db").catch(() => {});

const db = new Database("bench_class.db");

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
  close: () => db.close(),
};
