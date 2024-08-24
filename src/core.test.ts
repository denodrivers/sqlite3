import { assertEquals, assertRejects } from "@std/assert";
import { SQLITE_VERSION } from "./ffi.ts";
import {
  SqliteClient,
  type SqliteParameterType,
  SqlitePreparedStatement,
  SqliteTransaction,
} from "./core.ts";
import {
  testClientConnection,
  testSqlClient,
  testSqlPreparedStatement,
  testSqlTransaction,
} from "@stdext/sql/testing";
import { SqliteError } from "./util.ts";
import { SqliteConnection } from "./connection.ts";

Deno.test("std/sql prepared statement", async () => {
  const connectionUrl = ":memory:";
  const options: SqliteTransaction["options"] = {};
  const sql = "SELECT 1 as one;";

  const connection = new SqliteConnection(connectionUrl, options);
  await connection.connect();
  const preparedStatement = new SqlitePreparedStatement(
    connection,
    sql,
    options,
  );
  testSqlPreparedStatement(preparedStatement, {
    connectionUrl,
    options,
    sql,
  });
});

Deno.test("std/sql transaction", async () => {
  const connectionUrl = ":memory:";
  const options: SqliteTransaction["options"] = {};

  const connection = new SqliteConnection(connectionUrl, options);
  await connection.connect();
  const transaction = new SqliteTransaction(connection, options);

  testSqlTransaction(transaction, {
    connectionUrl,
    options,
  });
});

Deno.test("std/sql client", async (t) => {
  const connectionUrl = ":memory:";
  const options: SqliteClient["options"] = {};

  const client = new SqliteClient(connectionUrl, options);

  testSqlClient(client, { connectionUrl, options });
  await testClientConnection(
    t,
    SqliteClient,
    [
      connectionUrl,
      options,
    ],
  );
});

Deno.test("std/sql queries", async (t) => {
  const DB_URL = new URL("./test.db", import.meta.url);

  // Remove any existing test.db.
  await Deno.remove(DB_URL).catch(() => {});

  await t.step("open (expect error)", async () => {
    const db = new SqliteClient(DB_URL, { create: false });
    await assertRejects(
      async () => await db.connect(),
      SqliteError,
      "14:",
    );
  });

  await t.step("open (path string)", async () => {
    const db = new SqliteClient("test-path.db");
    await db.connect();
    await db.close();
    Deno.removeSync("test-path.db");
  });

  await t.step("open (readonly)", async () => {
    const db = new SqliteClient(":memory:", { readonly: true });
    await db.connect();
    await db.close();
  });

  let db!: SqliteClient;
  await t.step("open (url)", async () => {
    db = new SqliteClient(DB_URL, { int64: true });
    await db.connect();
  });

  if (typeof db !== "object") throw new Error("db open failed");

  await t.step("execute pragma", async () => {
    await db.execute("pragma journal_mode = WAL");
    await db.execute("pragma synchronous = normal");
    assertEquals(await db.execute("pragma temp_store = memory"), 0);
  });

  await t.step("select version (row as array)", async () => {
    const row = await db.queryOneArray<[string]>("select sqlite_version()");
    assertEquals(row, [SQLITE_VERSION]);
  });

  await t.step("select version (row as object)", async () => {
    const row = await db.queryOne<
      { version: string }
    >("select sqlite_version() as version");
    assertEquals(row, { version: SQLITE_VERSION });
  });

  await t.step("create table", async () => {
    await db.execute(`create table test (
      integer integer,
      text text not null,
      double double,
      blob blob not null,
      nullable integer
    )`);
  });

  await t.step("insert one", async () => {
    const changes = await db.execute(
      `insert into test (integer, text, double, blob, nullable)
      values (?, ?, ?, ?, ?)`,
      [
        0,
        "hello world",
        3.14,
        new Uint8Array([1, 2, 3]),
        null,
      ],
    );

    assertEquals(changes, 1);
  });

  await t.step("delete inserted row", async () => {
    await db.execute("delete from test where integer = 0");
  });

  await t.step("last insert row id (after insert)", () => {
    assertEquals(db.connection.db.lastInsertRowId, 1);
  });

  await t.step("prepared insert", async () => {
    const SQL = `insert into test (integer, text, double, blob, nullable)
    values (?, ?, ?, ?, ?)`;

    const rows: SqliteParameterType[][] = [];
    for (let i = 0; i < 10; i++) {
      rows.push([
        i,
        `hello ${i}`,
        3.14,
        new Uint8Array([3, 2, 1]),
        null,
      ]);
    }

    let changes = 0;
    await db.transaction(async (t) => {
      for (const row of rows) {
        changes += await t.execute(SQL, row) ?? 0;
      }
    });

    assertEquals(changes, 10);
  });

  await t.step("query array", async () => {
    const rows = await db.queryArray<
      [number, string, number, Uint8Array, null]
    >("select * from test where integer = 0 limit 1");

    assertEquals(rows.length, 1);
    const row = rows[0];
    assertEquals(row[0], 0);
    assertEquals(row[1], "hello 0");
    assertEquals(row[2], 3.14);
    assertEquals(row[3], new Uint8Array([3, 2, 1]));
    assertEquals(row[4], null);
  });

  await t.step("query object", async () => {
    const rows = await db.query<{
      integer: number;
      text: string;
      double: number;
      blob: Uint8Array;
      nullable: null;
    }>(
      "select * from test where integer != ? and text != ?",
      [
        1,
        "hello world",
      ],
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

  await t.step("query array (iter)", async () => {
    const rows = [];
    for await (
      const row of await db.queryManyArray<
        [number, string, number, Uint8Array, null]
      >("select * from test where integer = ? limit 1", [0])
    ) {
      rows.push(row);
    }

    assertEquals(rows.length, 1);

    const row = rows[0];
    assertEquals(row[0], 0);
    assertEquals(row[1], "hello 0");
    assertEquals(row[2], 3.14);
    assertEquals(row[3], new Uint8Array([3, 2, 1]));
    assertEquals(row[4], null);
  });

  await t.step("query object (iter)", async () => {
    const rows = [];
    for await (
      const row of db.queryMany<{
        integer: number;
        text: string;
        double: number;
        blob: Uint8Array;
        nullable: null;
      }>("select * from test where integer != ? and text != ?", [
        1,
        "hello world",
      ])
    ) {
      rows.push(row);
    }

    assertEquals(rows.length, 9);
    for (const row of rows) {
      assertEquals(typeof row.integer, "number");
      assertEquals(row.text, `hello ${row.integer}`);
      assertEquals(row.double, 3.14);
      assertEquals(row.blob, new Uint8Array([3, 2, 1]));
      assertEquals(row.nullable, null);
    }
  });

  await t.step("tagged template object", async () => {
    assertEquals(await db.sql`select 1, 2, 3`, [{ "1": 1, "2": 2, "3": 3 }]);
    assertEquals(
      await db.sql`select ${1} as a, ${Math.PI} as b, ${new Uint8Array([
        1,
        2,
      ])} as c`,
      [
        { a: 1, b: 3.141592653589793, c: new Uint8Array([1, 2]) },
      ],
    );

    assertEquals(await db.sql`select ${"1; DROP TABLE"}`, [{
      "?": "1; DROP TABLE",
    }]);
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
