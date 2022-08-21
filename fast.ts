import { Database } from "./rewrite/database.ts";
import { DB } from "https://deno.land/x/sqlite@v3.4.0/mod.ts";

await Deno.remove("temp.db").catch(() => {});
await Deno.remove("temp2.db").catch(() => {});

Deno.bench("noop", () => {});

Deno.bench("[ffi] open & close", () => {
  const db = new Database("bench.db");
  db.close();
});

Deno.bench("[wasm] open & close", () => {
  const db = new DB("bench2.db");
  db.close();
});

const db = new Database("temp.db");
const db2 = new DB("temp2.db");

db.execute(
  "create table bench (id integer primary key autoincrement, value text)",
);
db2.execute(
  "create table bench (id integer primary key autoincrement, value text)",
);

Deno.bench("[ffi] pragma", () => {
  db.execute("pragma journal_mode = WAL");
  db.execute("pragma synchronous = normal");
  db.execute("pragma temp_store = memory");
});

Deno.bench("[wasm] pragma", () => {
  db2.execute("pragma journal_mode = WAL");
  db2.execute("pragma synchronous = normal");
  db2.execute("pragma temp_store = memory");
});

Deno.bench("[ffi] insert", () => {
  db.execute("insert into bench (value) values ('hello')");
});

Deno.bench("[wasm] insert", () => {
  db2.execute("insert into bench (value) values ('hello')");
});

let n1 = false;
let n2 = false;

Deno.bench("[ffi] select", () => {
  if (!n1) {
    n1 = true;
    console.log("ffi", db.queryArray("select count(*) from bench"));
  }
  db.queryArray("select * from bench limit 1000");
});

Deno.bench("[wasm] select", () => {
  if (!n2) {
    n2 = true;
    console.log("wasm", db2.query("select count(*) from bench"));
  }
  db2.query("select * from bench limit 1000");
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

Deno.bench("[ffi] db.autocommit", () => {
  const _ = db.autocommit;
});

Deno.bench("[ffi] query version", () => {
  db.queryArray("SELECT sqlite_version()");
});

Deno.bench("[wasm] query version", () => {
  db2.query("SELECT sqlite_version()");
});

Deno.bench("[ffi] create & drop table", () => {
  db.execute("CREATE TABLE test (id INTEGER PRIMARY KEY)");
  db.execute("DROP TABLE test");
});

Deno.bench("[wasm] create & drop table", () => {
  db2.execute("CREATE TABLE test (id INTEGER PRIMARY KEY)");
  db2.execute("DROP TABLE test");
});

window.onunload = () => {
  db.close();
  db2.close();
};
