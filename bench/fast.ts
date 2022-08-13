import { Database } from "../mod.ts";
import { DB } from "https://deno.land/x/sqlite@v3.4.0/mod.ts";
// import { lib } from "../src/ffi.ts";

await Deno.remove("temp.db").catch(() => {});
await Deno.remove("temp2.db").catch(() => {});
const db = new Database("temp.db");
const db2 = new DB("temp2.db");

[
  "pragma journal_mode = WAL",
  "pragma synchronous = normal",
  "pragma temp_store = memory",
  "create table test (key integer primary key autoincrement, value text not null)",
].forEach((query) => {
  db.execute(query);
  db2.execute(query);
});

// const ptr = Number(db.unsafeRawHandle);
// const {} = lib;

Deno.bench("nop", () => {});

Deno.bench("[ffi] query version", () => {
  db.queryArray("select sqlite_version()");
});

Deno.bench("[wasm] query version", () => {
  db2.queryEntries("select sqlite_version()");
});

Deno.bench("[ffi] insert", () => {
  const prep = db.prepare("insert into test (value) values (?)");
  for (let i = 0; i < 10; i++) {
    prep.execute(`loop ${i}`);
  }
  prep.finalize();
});

Deno.bench("[wasm] insert", () => {
  const prep = db2.prepareQuery("insert into test (value) values (?)");
  for (let i = 0; i < 10; i++) {
    prep.execute([`loop ${i}`]);
  }
  prep.finalize();
});

Deno.bench("[ffi] query", () => {
  db.queryArray("select * from test");
});

Deno.bench("[wasm] query", () => {
  db2.queryEntries("select * from test");
});

Deno.bench("[ffi] db.changes", () => {
  const _ = db.changes;
});

Deno.bench("[wasm] db.changes", () => {
  const _ = db2.changes;
});

Deno.bench("[ffi] db.totalChanges", () => {
  const _ = db.totalChanges;
});

Deno.bench("[wasm] db.totalChanges", () => {
  const _ = db2.totalChanges;
});

Deno.bench("[ffi] db.lastInsertRowId", () => {
  const _ = db.lastInsertRowId;
});

Deno.bench("[wasm] db.lastInsertRowId", () => {
  const _ = db2.lastInsertRowId;
});

window.onunload = () => {
  db.close();
  db2.close();
  Deno.removeSync("temp.db");
  Deno.removeSync("temp2.db");
};
