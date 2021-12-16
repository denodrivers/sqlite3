import { DB } from "https://deno.land/x/sqlite@v3.0.0/mod.ts";
import { Backend } from "./backend.ts";

await Deno.remove("bench_wasm.db").catch(() => {});

const db = new DB("bench_wasm.db");

export default <Backend> {
  name: "sqlite_wasm",
  execute: (sql, params) => void db.query(sql, params as any),
  prepare: (sql) => {
    const prep = db.prepareQuery(sql);
    return {
      execute: (params) => prep.execute(params as any),
      finalize: () => prep.finalize(),
    };
  },
  close: () => db.close(),
};
