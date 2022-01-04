import { Database, SQLITE_VERSION } from "../mod.ts";
import { assertEquals, assertThrows } from "./deps.ts";

Deno.test("sqlite", async (t) => {
  const DB_URL = new URL("./test.db", import.meta.url);

  // Remove any existing test.db.
  await Deno.remove(DB_URL).catch(() => {});

  await t.step("open (expect error)", () => {
    assertThrows(
      () => new Database(DB_URL, { create: false }),
      Error,
      "(14)",
    );
  });

  await t.step("open (path string)", () => {
    const db = new Database("test-path.db");
    db.close();
    Deno.removeSync("test-path.db");
  });

  let db!: Database;
  await t.step("open (url)", () => {
    db = new Database(DB_URL);
  });

  if (typeof db !== "object") throw new Error("db open failed");

  await t.step("execute pragma", () => {
    db.execute("pragma journal_mode = WAL");
    db.execute("pragma synchronous = normal");
    db.execute("pragma temp_store = memory");
  });

  await t.step("select version", () => {
    const [version] = db.queryArray("select sqlite_version()")[0];
    assertEquals(version, SQLITE_VERSION);
  });

  await t.step("create table", () => {
    db.execute(`
      create table test (
        integer integer not null,
        text text not null,
        double double not null,
        blob blob not null,
        nullable integer
      )
    `);
  });

  await t.step("insert one", () => {
    db.execute(
      `insert into test (integer, text, double, blob, nullable)
      values (?, ?, ?, ?, ?)`,
      0,
      "hello world",
      3.14,
      new Uint8Array([1, 2, 3]),
      null,
    );

    assertEquals(db.totalChanges, 1);
  });

  await t.step("prepared insert", () => {
    const stmt = db.prepare(
      `insert into test (integer, text, double, blob, nullable)
      values (?, ?, ?, ?, ?)`,
    );

    for (let i = 0; i < 10; i++) {
      stmt.execute(
        i,
        `hello ${i}`,
        3.14,
        new Uint8Array([3, 2, 1]),
        null,
      );
    }

    stmt.finalize();

    assertEquals(db.totalChanges, 11);
  });

  await t.step("query array", () => {
    const row = db.queryArray<[number, string, number, Uint8Array, null]>(
      "select * from test where integer = ?",
      0,
    )[0];
    assertEquals(row[0], 0);
    assertEquals(row[1], "hello world");
    assertEquals(row[2], 3.14);
    assertEquals(row[3], new Uint8Array([1, 2, 3]));
    assertEquals(row[4], null);
  });

  await t.step("query object", () => {
    const rows = db.queryObject<{
      integer: number;
      text: string;
      double: number;
      blob: Uint8Array;
      nullable: null;
    }>("select * from test where integer != :integer and text != :text", {
      integer: 1,
      text: "hello world",
    });

    assertEquals(rows.length, 9);
    for (const row of rows) {
      assertEquals(typeof row.integer, "number");
      assertEquals(row.text, `hello ${row.integer}`);
      assertEquals(row.double, 3.14);
      assertEquals(row.blob, new Uint8Array([3, 2, 1]));
      assertEquals(row.nullable, null);
    }
  });

  await t.step("query with string param", () => {
    const row = db.queryArray<[number, string, number, Uint8Array, null]>(
      "select * from test where text = ?",
      "hello world",
    )[0];
    assertEquals(row[0], 0);
    assertEquals(row[1], "hello world");
    assertEquals(row[2], 3.14);
    assertEquals(row[3], new Uint8Array([1, 2, 3]));
    assertEquals(row[4], null);
  });

  await t.step("more than 32-bit int", () => {
    const value = 978307200000;
    db.execute(
      `insert into test (integer, text, double, blob, nullable)
    values (?, ?, ?, ?, ?)`,
      value,
      "bigint",
      0,
      new Uint8Array(0),
      null,
    );
    const [int] = db.queryArray<[number]>(
      "select integer from test where text = ?",
      "bigint",
    )[0];
    assertEquals(int, value);
  });

  await t.step("more than 32-bit signed int", () => {
    const value = -978307200000;
    db.execute(
      `insert into test (integer, text, double, blob, nullable)
    values (?, ?, ?, ?, ?)`,
      value,
      "bigint2",
      0,
      new Uint8Array(0),
      null,
    );
    const [int] = db.queryArray<[number]>(
      "select integer from test where text = ?",
      "bigint2",
    )[0];
    assertEquals(int, value);
  });

  await t.step("max 64-bit signed int", () => {
    const value = 0x7fffffffffffffffn;
    db.execute(
      `insert into test (integer, text, double, blob, nullable)
    values (?, ?, ?, ?, ?)`,
      value,
      "bigint3",
      0,
      new Uint8Array(0),
      null,
    );
    const [int] = db.queryArray<[number]>(
      "select integer from test where text = ?",
      "bigint3",
    )[0];
    assertEquals(int, value);
  });

  await t.step("drop table", () => {
    db.execute("drop table test");
  });

  await t.step("close", () => {
    db.close();
    Deno.removeSync(DB_URL);
  });
});
