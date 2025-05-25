import { Database } from "https://deno.land/x/sqlite3@0.4.3/mod.ts";
import { bench, run } from "../../node_modules/mitata/src/cli.mjs";

const db = new Database("./bench/northwind.sqlite");

{
  const sql = db.prepare(`SELECT * FROM "Order"`);
  bench('SELECT * FROM "Order"', () => {
    sql.reset();
    const rows = [];
    for (const row of sql) {
      rows.push(row.asObject());
    }
  });
}

{
  const sql = db.prepare(`SELECT * FROM "Product"`);
  bench('SELECT * FROM "Product"', () => {
    sql.reset();
    const rows = [];
    for (const row of sql) {
      rows.push(row.asObject());
    }
  });
}

{
  const sql = db.prepare(`SELECT * FROM "OrderDetail"`);
  bench('SELECT * FROM "OrderDetail"', () => {
    sql.reset();
    const rows = [];
    for (const row of sql) {
      rows.push(row.asObject());
    }
  });
}

await run();
