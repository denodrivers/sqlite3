import { DB } from "https://deno.land/x/sqlite@v3.4.1/mod.ts";
import { bench, run } from "https://esm.sh/mitata";

const db = new DB("./bench/northwind.sqlite");

{
  const sql = db.prepareQuery(`SELECT * FROM "Order"`);
  bench('SELECT * FROM "Order" all', () => {
    sql.all();
  });
  bench('SELECT * FROM "Order" values', () => {
    sql.allEntries();
  });
  bench('SELECT * FROM "Order" run', () => {
    sql.execute();
  });
}

{
  const sql = db.prepareQuery(`SELECT * FROM "Product"`);
  bench('SELECT * FROM "Product" all', () => {
    sql.all();
  });
  bench('SELECT * FROM "Product" values', () => {
    sql.allEntries();
  });
  bench('SELECT * FROM "Product" run', () => {
    sql.execute();
  });
}

{
  const sql = db.prepareQuery(`SELECT * FROM "OrderDetail"`);
  bench('SELECT * FROM "OrderDetail" all', () => {
    sql.all();
  });
  bench('SELECT * FROM "OrderDetail" values', () => {
    sql.allEntries();
  });
  bench('SELECT * FROM "OrderDetail" run', () => {
    sql.execute();
  });
}

await run();
