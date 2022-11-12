import { Database } from "../../mod.ts";

const db = new Database("./bench/northwind.sqlite", {
  unsafeConcurrency: true,
});

{
  const sql = db.prepare(`SELECT * FROM "Order"`);

  Deno.bench('SELECT * FROM "Order" all', () => {
    sql.all();
  });

  Deno.bench('SELECT * FROM "Order" values', () => {
    sql.values();
  });

  Deno.bench('SELECT * FROM "Order" run', () => {
    sql.run();
  });
}

{
  const sql = db.prepare(`SELECT * FROM "Product"`);

  Deno.bench('SELECT * FROM "Product" all', () => {
    sql.all();
  });

  Deno.bench('SELECT * FROM "Product" values', () => {
    sql.values();
  });

  Deno.bench('SELECT * FROM "Product" run', () => {
    sql.run();
  });
}

{
  const sql = db.prepare(`SELECT * FROM "OrderDetail"`);

  Deno.bench('SELECT * FROM "OrderDetail" all', () => {
    sql.all();
  });

  Deno.bench('SELECT * FROM "OrderDetail" values', () => {
    sql.values();
  });

  Deno.bench('SELECT * FROM "OrderDetail" run', () => {
    sql.run();
  });
}
