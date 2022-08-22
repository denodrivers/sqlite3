import {
  Database,
  isComplete,
  SQLITE_SOURCEID,
  SQLITE_VERSION,
} from "../rewrite/database.ts";
import { assert, assertEquals, assertThrows } from "./deps.ts";

Deno.test("sqlite", async (t) => {
  await t.step("sourceid", () => {
    assert(SQLITE_SOURCEID.length > 0);
  });

  await t.step("is complete", () => {
    assert(!isComplete(""));
    assert(!isComplete("select sqlite_version()"));

    assert(isComplete("select x from y;"));
    assert(isComplete("select sqlite_version();"));
  });

  const DB_URL = new URL("./test.db", import.meta.url);

  // Remove any existing test.db.
  await Deno.remove(DB_URL).catch(() => {});

  await t.step("open (expect error)", () => {
    assertThrows(
      () => new Database(DB_URL, { create: false }),
      Error,
      "SQLite3 error: 14",
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
    db.exec("pragma journal_mode = WAL");
    db.exec("pragma synchronous = normal");
    db.exec("pragma temp_store = memory");
  });

  await t.step("select version", () => {
    const [version] = db.query("select sqlite_version()").values()[0];
    assertEquals(version, SQLITE_VERSION);
  });

  await t.step("autocommit", () => {
    assertEquals(db.autocommit, true);
  });

  await t.step("last insert row id", () => {
    assertEquals(db.lastInsertRowId, 0);
  });

  await t.step("create table", () => {
    db.exec(`create table test (
      integer integer,
      text text not null,
      double double,
      blob blob not null,
      nullable integer
    )`);
  });

  await t.step("insert one", () => {
    db.exec(
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

  await t.step("delete inserted row", () => {
    db.exec("delete from test where integer = 0");
  });

  await t.step("last insert row id (after insert)", () => {
    assertEquals(db.lastInsertRowId, 1);
  });

  await t.step("prepared insert", () => {
    const SQL = `insert into test (integer, text, double, blob, nullable)
    values (?, ?, ?, ?, ?)`;
    const stmt = db.prepare(SQL);
    assertEquals(
      stmt.toString(),
      `insert into test (integer, text, double, blob, nullable)
    values (NULL, NULL, NULL, NULL, NULL)`,
    );

    for (let i = 0; i < 10; i++) {
      stmt.run(
        i,
        `hello ${i}`,
        3.14,
        new Uint8Array([3, 2, 1]),
        null,
      );
    }

    stmt.finalize();

    assertEquals(db.totalChanges, 12);
  });

  await t.step("query array", () => {
    const row = db.query("select * from test where integer = 0").values<
      [number, string, number, Uint8Array, null]
    >()[0];

    assertEquals(row[0], 0);
    assertEquals(row[1], "hello 0");
    assertEquals(row[2], 3.14);
    assertEquals(row[3], new Uint8Array([3, 2, 1]));
    assertEquals(row[4], null);
  });

  await t.step("query object", () => {
    const rows = db.query("select * from test where integer != ? and text != ?")
      .all<{
        integer: number;
        text: string;
        double: number;
        blob: Uint8Array;
        nullable: null;
      }>(
        1,
        "hello world",
      );

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
    const row = db.query(
      "select * from test where text = ?",
    ).values<[number, string, number, Uint8Array, null]>("hello 0")[0];

    assertEquals(row[0], 0);
    assertEquals(row[1], "hello 0");
    assertEquals(row[2], 3.14);
    assertEquals(row[3], new Uint8Array([3, 2, 1]));
    assertEquals(row[4], null);
  });

  await t.step("drop table", () => {
    db.exec("drop table test");
  });

  await t.step("close", () => {
    db.close();
    Deno.removeSync(DB_URL);
  });
});
