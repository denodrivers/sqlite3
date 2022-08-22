import { Database } from "../rewrite/database.ts";
import { bench, run } from "https://esm.sh/mitata";

const db = new Database("./bench/northwind.sqlite");

{
  bench("serialize", () => {
    db.serialize();
  });
}

{
  const sql = db.prepare(`SELECT * FROM "Order"`);
  bench('SELECT * FROM "Order"', () => {
    sql.all();
  });
  bench('SELECT * FROM "Order"', () => {
    sql.values();
  });
  bench('SELECT * FROM "Order" run', () => {
    sql.run();
  });
  bench('SELECT * FROM "Order" columnCount', () => {
    sql.columnCount;
  });
}

{
  const sql = db.prepare(`SELECT * FROM "Product"`);
  bench('SELECT * FROM "Product"', () => {
    sql.all();
  });
  bench('SELECT * FROM "Product"', () => {
    sql.values();
  });
  bench('SELECT * FROM "Product" run', () => {
    sql.run();
  });
}

{
  const sql = db.prepare(`SELECT * FROM "OrderDetail"`);
  bench('SELECT * FROM "OrderDetail"', () => {
    sql.all();
  });
  bench('SELECT * FROM "OrderDetail"', () => {
    sql.values();
  });
  bench('SELECT * FROM "OrderDetail" run', () => {
    sql.run();
  });
}

await run();
