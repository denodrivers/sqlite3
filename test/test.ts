import {
  Database,
  isComplete,
  SQLITE_SOURCEID,
  SQLITE_VERSION,
  SqliteError,
} from "../mod.ts";
import { assert, assertEquals, assertThrows } from "./deps.ts";

console.log("sqlite version:", SQLITE_VERSION);

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

  await t.step("open (readonly)", () => {
    const db = new Database(":memory:", { readonly: true });
    db.close();
  });

  let db!: Database;
  await t.step("open (url)", () => {
    db = new Database(DB_URL, { int64: true });
  });

  if (typeof db !== "object") throw new Error("db open failed");

  await t.step("execute pragma", () => {
    db.exec("pragma journal_mode = WAL");
    db.exec("pragma synchronous = normal");
    assertEquals(db.exec("pragma temp_store = memory"), 0);
  });

  await t.step("select version (row as array)", () => {
    const [version] = db.prepare("select sqlite_version()").value<[string]>()!;
    assertEquals(version, SQLITE_VERSION);
  });

  await t.step("select version (row as object)", () => {
    const { version } = db.prepare("select sqlite_version() as version").get<
      { version: string }
    >()!;
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

    const insertMany = db.transaction((data: any[]) => {
      for (const row of data) {
        stmt.run(row);
      }
    });

    const rows = [];
    for (let i = 0; i < 10; i++) {
      rows.push([
        i,
        `hello ${i}`,
        3.14,
        new Uint8Array([3, 2, 1]),
        null,
      ]);
    }

    insertMany.default(rows);

    stmt.finalize();

    assertEquals(db.totalChanges, 12);
  });

  await t.step("query array", () => {
    const row = db.prepare("select * from test where integer = 0").values<
      [number, string, number, Uint8Array, null]
    >()[0];

    assertEquals(row[0], 0);
    assertEquals(row[1], "hello 0");
    assertEquals(row[2], 3.14);
    assertEquals(row[3], new Uint8Array([3, 2, 1]));
    assertEquals(row[4], null);
  });

  await t.step("query object", () => {
    const rows = db.prepare(
      "select * from test where integer != ? and text != ?",
    )
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

  await t.step("query json", () => {
    const row = db
      .prepare(
        "select json('[1,2,3]'), json_object('name', 'alex'), '{\"no_subtype\": true}'",
      )
      .values<[number[], { name: string }, string]>()[0];

    assertEquals(row[0], [1, 2, 3]);
    assertEquals(row[1], { name: "alex" });
    assertEquals(row[2], '{"no_subtype": true}');
  });

  await t.step("query with string param", () => {
    const row = db.prepare(
      "select * from test where text = ?",
    ).values<[number, string, number, Uint8Array, null]>("hello 0")[0];

    assertEquals(row[0], 0);
    assertEquals(row[1], "hello 0");
    assertEquals(row[2], 3.14);
    assertEquals(row[3], new Uint8Array([3, 2, 1]));
    assertEquals(row[4], null);
  });

  await t.step("query with string param (named)", () => {
    const row = db.prepare(
      "select * from test where text = :p1",
    ).values<[number, string, number, Uint8Array, null]>({ p1: "hello 0" })[0];

    assertEquals(row[0], 0);
    assertEquals(row[1], "hello 0");
    assertEquals(row[2], 3.14);
    assertEquals(row[3], new Uint8Array([3, 2, 1]));
    assertEquals(row[4], null);
  });
  await t.step("query parameters", () => {
    const row = db.prepare(
      "select ?, ?, ?, ?, ?",
    ).values<[number, string, string, string, string]>(
      1,
      "alex",
      new Date("2023-01-01"),
      [1, 2, 3],
      { name: "alex" },
    )[0];

    assertEquals(row[0], 1);
    assertEquals(row[1], "alex");
    assertEquals(row[2], "2023-01-01T00:00:00.000Z");
    assertEquals(row[3], "[1,2,3]");
    assertEquals(row[4], '{"name":"alex"}');
  });

  await t.step(".sql tagged template", () => {
    assertEquals(db.sql`select 1, 2, 3`, [{ "1": 1, "2": 2, "3": 3 }]);
    assertEquals(
      db.sql`select ${1} as a, ${Math.PI} as b, ${new Uint8Array([1, 2])} as c`,
      [
        { a: 1, b: 3.141592653589793, c: new Uint8Array([1, 2]) },
      ],
    );

    assertEquals(db.sql`select ${"1; DROP TABLE"}`, [{ "?": "1; DROP TABLE" }]);
  });

  await t.step("more than 32-bit int", () => {
    const value = 978307200000;
    db.exec(
      `insert into test (integer, text, double, blob, nullable)
    values (?, ?, ?, ?, ?)`,
      value,
      "bigint",
      0,
      new Uint8Array(1),
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
      new Uint8Array(1),
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
      new Uint8Array(1),
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
      new Uint8Array(1),
      null,
    );
    const [int, double] = db.prepare(
      "select integer, double from test where text = ?",
    ).values<[number, number]>("nan")[0];
    assertEquals(int, null);
    assertEquals(double, null);
  });

  await t.step("empty string on not null column", () => {
    db.exec(`create table empty_string_not_null ( name text not null )`);
    db.exec("insert into empty_string_not_null (name) values (?)", "");
    const s = db.prepare("select * from empty_string_not_null").value<
      string[]
    >();
    assertEquals(s, [""]);
  });

  await t.step("enable update or delete limit", () => {
    db.run(`
      create table test_limit (
        id integer primary key autoincrement
      )
    `);

    db.run(`
      delete from test_limit
      order by id
      limit 1
    `);

    db.run(`drop table test_limit`);
  });

  await t.step("create blob table", () => {
    db.exec(`
      create table blobs (
        id integer primary key,
        data blob
      )
    `);
  });

  await t.step("empty blob vs null blob", () => {
    db.exec("insert into blobs (id, data) values (?, ?)", 0, new Uint8Array());
    db.exec("insert into blobs (id, data) values (?, ?)", 1, null);

    const [
      [blob1],
      [blob2],
    ] = db.prepare("select data from blobs").values<
      [Uint8Array | null]
    >();

    assertEquals(blob1, new Uint8Array());
    assertEquals(blob2, null);
  });

  await t.step("insert blob", () => {
    const blob = new Uint8Array(1024 * 32);
    db.exec("insert into blobs (id, data) values (?, ?)", 3, blob);
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

    await t.step("read from blob (stream)", async () => {
      let chunks = 0;
      for await (const chunk of blob.readable) {
        assertEquals(chunk, new Uint8Array(1024 * 16).fill(0x01));
        chunks++;
      }
      assertEquals(chunks, 2);
    });

    await t.step("read from blob (iter)", () => {
      let chunks = 0;
      for (const chunk of blob) {
        assertEquals(chunk, new Uint8Array(1024 * 16).fill(0x01));
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

    await t.step("close blob", () => {
      blob.close();
    });
  });

  await t.step({
    name: "define functions",
    sanitizeResources: false,
    fn(): void {
      db.function("deno_add", (a: number, b: number): number => {
        return a + b;
      });

      db.function("deno_uppercase", (a: string): string => {
        return a.toUpperCase();
      });

      db.function("deno_buffer_add_1", (a: Uint8Array): Uint8Array => {
        const result = new Uint8Array(a.length);
        for (let i = 0; i < a.length; i++) {
          result[i] = a[i] + 1;
        }
        return result;
      });

      db.function("regexp", (a: string, b: string): boolean => {
        return new RegExp(b).test(a);
      });

      db.aggregate("deno_sum_2x", {
        start: 0,
        step(sum: number, value: number): number {
          return sum + value;
        },
        final(sum: number): number {
          return sum * 2;
        },
      });
    },
  });

  await t.step("test functions", () => {
    const [result] = db
      .prepare("select deno_add(?, ?)")
      .value<[number]>(1, 2)!;
    assertEquals(result, 3);

    const [result2] = db
      .prepare("select deno_uppercase(?)")
      .value<[string]>("hello")!;
    assertEquals(result2, "HELLO");

    const [result3] = db
      .prepare("select deno_buffer_add_1(?)")
      .value<[Uint8Array]>(new Uint8Array([1, 2, 3]))!;
    assertEquals(result3, new Uint8Array([2, 3, 4]));

    const [result4] = db.prepare("select deno_add(?, ?)").value<[number]>(
      1.5,
      1.5,
    )!;
    assertEquals(result4, 3);

    const [result5] = db
      .prepare("select regexp(?, ?)")
      .value<[number]>("hello", "h.*")!;
    assertEquals(result5, 1);

    const [result6] = db
      .prepare("select regexp(?, ?)")
      .value<[number]>("hello", "x.*")!;
    assertEquals(result6, 0);

    db.exec("create table aggr_test (value integer)");
    db.exec("insert into aggr_test (value) values (1)");
    db.exec("insert into aggr_test (value) values (2)");
    db.exec("insert into aggr_test (value) values (3)");

    const stmt = db.prepare("select deno_sum_2x(value) from aggr_test");
    const [result7] = stmt.value<[number]>()!;
    assertEquals(result7, 12);
    // Releases lock from table.
    stmt.finalize();

    db.exec("drop table aggr_test");
  });

  await t.step("fts5", () => {
    db.exec("create virtual table tbl_fts using fts5(a)");
    db.exec("drop table tbl_fts");
  });

  await t.step("drop table", () => {
    db.exec("drop table test");
    db.exec("drop table blobs");
  });

  await t.step({
    name: "backup",
    fn(): void {
      const url = new URL("backup.db", import.meta.url);
      const db2 = new Database(url);
      db.backup(db2, "main");

      db2.close();

      try {
        Deno.removeSync(url);
      } catch (_) { /* ignore */ }
    },
  });

  await t.step("backup (error)", () => {
    // source == destination
    assertThrows(
      () => db.backup(db, "main"),
      Error,
      "source and destination must be distinct",
    );
  });

  await t.step({
    name: "close",
    sanitizeResources: false,
    fn(): void {
      db.close();
      try {
        Deno.removeSync(DB_URL);
      } catch (_) { /** ignore, already being used */ }
    },
  });
});
