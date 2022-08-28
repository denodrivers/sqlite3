import {
  Database,
  isComplete,
  SQLITE_SOURCEID,
  SQLITE_VERSION,
  SqliteError,
} from "../mod.ts";
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
      SqliteError,
      "14:",
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
    const [version] = db.query("select sqlite_version()").get<[string]>()!;
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

  await t.step("query with string param (named)", () => {
    const row = db.query(
      "select * from test where text = :p1",
    ).values<[number, string, number, Uint8Array, null]>({ p1: "hello 0" })[0];

    assertEquals(row[0], 0);
    assertEquals(row[1], "hello 0");
    assertEquals(row[2], 3.14);
    assertEquals(row[3], new Uint8Array([3, 2, 1]));
    assertEquals(row[4], null);
  });

  await t.step("more than 32-bit int", () => {
    const value = 978307200000;
    db.exec(
      `insert into test (integer, text, double, blob, nullable)
    values (?, ?, ?, ?, ?)`,
      value,
      "bigint",
      0,
      new Uint8Array(0),
      null,
    );
    const [int] = db.prepare(
      "select integer from test where text = ?",
    ).values<[number]>("bigint")[0];
    assertEquals(int, value);
  });

  await t.step("more than 32-bit signed int", () => {
    const value = -978307200000;
    db.exec(
      `insert into test (integer, text, double, blob, nullable)
    values (?, ?, ?, ?, ?)`,
      value,
      "bigint2",
      0,
      new Uint8Array(0),
      null,
    );
    const [int] = db.prepare(
      "select integer from test where text = ?",
    ).values<[number]>("bigint2")[0];
    assertEquals(int, value);
  });

  await t.step("max 64-bit signed int", () => {
    const value = 0x7fffffffffffffffn;
    db.exec(
      `insert into test (integer, text, double, blob, nullable)
    values (?, ?, ?, ?, ?)`,
      value,
      "bigint3",
      0,
      new Uint8Array(0),
      null,
    );
    const [int] = db.prepare(
      "select integer from test where text = ?",
    ).values<[bigint]>("bigint3")[0];
    assertEquals(int, value);
  });

  await t.step("nan value", () => {
    db.exec(
      `insert into test (integer, text, double, blob, nullable)
    values (?, ?, ?, ?, ?)`,
      NaN,
      "nan",
      NaN,
      new Uint8Array(0),
      null,
    );
    const [int, double] = db.prepare(
      "select integer, double from test where text = ?",
    ).values<[number, number]>("nan")[0];
    assertEquals(int, null);
    assertEquals(double, null);
  });

  await t.step("create blob table", () => {
    db.exec(`
      create table blobs (
        id integer primary key,
        data blob not null
      )
    `);
  });

  await t.step("insert blob", () => {
    const blob = new Uint8Array(1024 * 32);
    db.exec("insert into blobs (id, data) values (?, ?)", 0, blob);
  });

  await t.step("sql blob", async (t) => {
    const blob = db.openBlob({
      table: "blobs",
      column: "data",
      row: db.lastInsertRowId,
      readonly: false,
    });

    await t.step("byte legnth", () => {
      assertEquals(blob.byteLength, 1024 * 32);
    });

    await t.step("read from blob", () => {
      const data = new Uint8Array(blob.byteLength);
      blob.readSync(0, data);
      assertEquals(data, new Uint8Array(1024 * 32));
    });

    await t.step("write to blob", () => {
      const data = new Uint8Array(1024 * 32).fill(0x01);
      blob.writeSync(0, data);
    });

    await t.step("read from blob (async)", async () => {
      const data = new Uint8Array(blob.byteLength);
      await blob.read(0, data);
      assertEquals(data, new Uint8Array(1024 * 32).fill(0x01));
    });

    await t.step("write to blob (async)", async () => {
      const data = new Uint8Array(1024 * 32).fill(0x02);
      await blob.write(0, data);
    });

    await t.step("read from blob (stream)", async () => {
      let chunks = 0;
      for await (const chunk of blob.readable) {
        assertEquals(chunk, new Uint8Array(1024 * 16).fill(0x02));
        chunks++;
      }
      assertEquals(chunks, 2);
    });

    await t.step("read from blob (iter)", () => {
      let chunks = 0;
      for (const chunk of blob) {
        assertEquals(chunk, new Uint8Array(1024 * 16).fill(0x02));
        chunks++;
      }
      assertEquals(chunks, 2);
    });

    await t.step("write to blob (stream)", async () => {
      const writer = blob.writable.getWriter();
      await writer.write(new Uint8Array(1024 * 16).fill(0x03));
      await writer.write(new Uint8Array(1024 * 16).fill(0x03));
      await writer.close();
    });

    await t.step("read from blob (async iter)", async () => {
      let chunks = 0;
      for await (const chunk of blob) {
        assertEquals(chunk, new Uint8Array(1024 * 16).fill(0x03));
        chunks++;
      }
      assertEquals(chunks, 2);
    });

    await t.step("close blob", () => {
      blob.close();
    });
  });

  await t.step("drop table", () => {
    db.exec("drop table test");
    db.exec("drop table blobs");
  });

  await t.step("close", () => {
    db.close();
    try {
      Deno.removeSync(DB_URL);
    } catch (_) { /** ignore, already being used */ }
  });
});
