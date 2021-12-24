import { DB } from "https://deno.land/x/sqlite@v3.0.0/mod.ts";
import { fromFileUrl } from "../deps.ts";
import { Backend } from "./backend.ts";

const DB_URL = new URL("./bench_wasm.db", import.meta.url);
await Deno.remove(DB_URL).catch(() => {});
const db = new DB(fromFileUrl(DB_URL));

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
  query: (sql) => db.query(sql),
  close: () => db.close(),
};
