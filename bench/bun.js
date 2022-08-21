import { bench, run } from "mitata";
import { Database } from "bun:sqlite";

const db = Database.open("./bench/northwind.sqlite");

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
}

{
  const sql = db.prepare(`SELECT * FROM "Product"`);
  bench('SELECT * FROM "Product"', () => {
    sql.all();
  });
  bench('SELECT * FROM "Order"', () => {
    sql.values();
  });
  bench('SELECT * FROM "Order" run', () => {
    sql.run();
  });
}

{
  const sql = db.prepare(`SELECT * FROM "OrderDetail"`);
  bench('SELECT * FROM "OrderDetail"', () => {
    sql.all();
  });
  bench('SELECT * FROM "Order"', () => {
    sql.values();
  });
  bench('SELECT * FROM "Order" run', () => {
    sql.run();
  });
}

await run();
