import { bench, run } from "mitata";
import { Database } from "bun:sqlite";

const db = Database.open("./bench/northwind.sqlite");

{
  const sql = db.prepare(`SELECT * FROM "Order"`);
  bench('SELECT * FROM "Order" all', () => {
    sql.all();
  });
  bench('SELECT * FROM "Order" values', () => {
    sql.values();
  });
  bench('SELECT * FROM "Order" run', () => {
    sql.run();
  });
}

{
  const sql = db.prepare(`SELECT * FROM "Product"`);
  bench('SELECT * FROM "Product" all', () => {
    sql.all();
  });
  bench('SELECT * FROM "Product" values', () => {
    sql.values();
  });
  bench('SELECT * FROM "Product" run', () => {
    sql.run();
  });
}

{
  const sql = db.prepare(`SELECT * FROM "OrderDetail"`);
  bench('SELECT * FROM "OrderDetail" all', () => {
    sql.all();
  });
  bench('SELECT * FROM "OrderDetail" values', () => {
    sql.values();
  });
  bench('SELECT * FROM "OrderDetail" run', () => {
    sql.run();
  });
}

await run();
