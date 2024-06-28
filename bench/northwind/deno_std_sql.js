import { SqliteClient } from "../../std_sql.ts";

const db = new SqliteClient("./bench/northwind.sqlite", {
  unsafeConcurrency: true,
});

await db.connect();

{
  const sql = db.prepare(`SELECT * FROM "Order"`);

  Deno.bench('SELECT * FROM "Order" all', async () => {
    await sql.query();
  });

  Deno.bench('SELECT * FROM "Order" values', async () => {
    await sql.queryArray();
  });

  Deno.bench('SELECT * FROM "Order" run', async () => {
    await sql.execute();
  });
}

{
  const sql = db.prepare(`SELECT * FROM "Product"`);

  Deno.bench('SELECT * FROM "Product" all', async () => {
    await sql.query();
  });

  Deno.bench('SELECT * FROM "Product" values', async () => {
    await sql.queryArray();
  });

  Deno.bench('SELECT * FROM "Product" run', async () => {
    await sql.execute();
  });
}

{
  const sql = db.prepare(`SELECT * FROM "OrderDetail"`);

  Deno.bench('SELECT * FROM "OrderDetail" all', async () => {
    await sql.query();
  });

  Deno.bench('SELECT * FROM "OrderDetail" values', async () => {
    await sql.queryArray();
  });

  Deno.bench('SELECT * FROM "OrderDetail" run', async () => {
    await sql.execute();
  });
}
