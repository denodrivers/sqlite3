import { assertEquals, assertRejects } from "@std/assert";
import { SQLITE_VERSION } from "./ffi.ts";
import {
  SqliteClient,
  type SqliteParameterType,
  type SqlitePreparable,
  SqlitePreparedStatement,
  type SqliteQueriable,
  SqliteTransaction,
  type SqliteTransactionable,
} from "./core.ts";
import { SqliteError } from "./util.ts";
import { SqliteConnection } from "./connection.ts";
import { SqliteEventTarget } from "./events.ts";
import {
  testClientConnection,
  testSqlClient,
  testSqlEventTarget,
  testSqlPreparedStatement,
  testSqlTransaction,
} from "@stdext/sql/testing";
import {
  isSqlPreparable,
  isSqlTransaction,
  isSqlTransactionable,
} from "@stdext/sql";

Deno.test(`sql/type test`, async (t) => {
  const connectionUrl = ":memory:";
  const options: SqliteTransaction["options"] = {};
  const sql = "SELECT 1 as one;";

  await using connection = new SqliteConnection(connectionUrl, options);
  await connection.connect();
  const preparedStatement = new SqlitePreparedStatement(
    connection,
    sql,
    options,
  );
  const transaction = new SqliteTransaction(connection, options);
  const eventTarget = new SqliteEventTarget();
  const client = new SqliteClient(connectionUrl, options);

  const expects = {
    connectionUrl,
    options,
    clientPoolOptions: options,
    sql,
  };

  await t.step(`sql/PreparedStatement`, () => {
    testSqlPreparedStatement(preparedStatement, expects);
  });

  await t.step(`sql/SqlTransaction`, () => {
    testSqlTransaction(transaction, expects);
  });

  await t.step(`sql/SqlTransactionable`, () => {
    testSqlEventTarget(eventTarget);
  });
  await t.step(`sql/SqlTransactionable`, () => {
    testSqlClient(client, expects);
  });
});

Deno.test("Client Test", async (t) => {
  const connectionUrl = ":memory:";

  testSqlClient(new SqliteClient(connectionUrl), {
    connectionUrl: connectionUrl,
    options: {},
  });

  await testClientConnection(t, SqliteClient, [connectionUrl, {}]);
  await using client = new SqliteClient(connectionUrl);
  await client.connect();
  await client.execute("DROP TABLE IF EXISTS sqltesttable");
  await client.execute(
    "CREATE TABLE IF NOT EXISTS sqltesttable (testcol TEXT)",
  );
  try {
    await testTransactionable(client);
  } finally {
    await client.execute("DROP TABLE IF EXISTS sqltesttable");
  }
});

Deno.test("sqlite core", async (t) => {
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
      const row of await db.queryMany<{
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

async function testQueriable(
  queriable: SqliteQueriable,
): Promise<void> {
  await queriable.execute("DELETE FROM sqltesttable");

  const resultExecute = await queriable.execute(
    "INSERT INTO sqltesttable (testcol) VALUES (?),(?),(?)",
    ["queriable 1", "queriable 2", "queriable 3"],
  );
  assertEquals(resultExecute, 3);

  const resultQuery = await queriable.query("SELECT * FROM sqltesttable");
  assertEquals(resultQuery, [
    { testcol: "queriable 1" },
    { testcol: "queriable 2" },
    { testcol: "queriable 3" },
  ]);

  const resultQueryOne = await queriable.queryOne(
    "SELECT * FROM sqltesttable WHERE testcol LIKE ?",
    ["queriable%"],
  );
  assertEquals(resultQueryOne, { testcol: "queriable 1" });

  const resultQueryMany = await Array.fromAsync(
    queriable.queryMany("SELECT * FROM sqltesttable WHERE testcol LIKE ?", [
      "queriable%",
    ]),
  );
  assertEquals(resultQueryMany, [
    { testcol: "queriable 1" },
    { testcol: "queriable 2" },
    { testcol: "queriable 3" },
  ]);

  const resultQueryArray = await queriable.queryArray(
    "SELECT * FROM sqltesttable WHERE testcol LIKE ?",
    ["queriable%"],
  );
  assertEquals(resultQueryArray, [
    ["queriable 1"],
    ["queriable 2"],
    ["queriable 3"],
  ]);

  const resultQueryOneArray = await queriable.queryOneArray(
    "SELECT * FROM sqltesttable WHERE testcol LIKE ?",
    ["queriable%"],
  );
  assertEquals(resultQueryOneArray, ["queriable 1"]);

  const resultQueryManyArray = await Array.fromAsync(
    queriable.queryManyArray(
      "SELECT * FROM sqltesttable WHERE testcol LIKE ?",
      ["queriable%"],
    ),
  );
  assertEquals(resultQueryManyArray, [
    ["queriable 1"],
    ["queriable 2"],
    ["queriable 3"],
  ]);

  const resultSql = await queriable
    .sql`SELECT * FROM sqltesttable WHERE testcol LIKE ${"queriable%"}`;
  assertEquals(resultSql, [
    { testcol: "queriable 1" },
    { testcol: "queriable 2" },
    { testcol: "queriable 3" },
  ]);

  const resultSqlArray = await queriable
    .sqlArray`SELECT * FROM sqltesttable WHERE testcol LIKE ${"queriable%"}`;
  assertEquals(resultSqlArray, [
    ["queriable 1"],
    ["queriable 2"],
    ["queriable 3"],
  ]);
}

async function testPreparedStatement(
  preparedStatement: SqlitePreparedStatement,
): Promise<void> {
  const resultExecute = await preparedStatement.execute(["queriable%"]);
  assertEquals(resultExecute, 3);

  const resultQuery = await preparedStatement.query(["queriable%"]);
  assertEquals(resultQuery, [
    { testcol: "queriable 1" },
    { testcol: "queriable 2" },
    { testcol: "queriable 3" },
  ]);

  const resultQueryOne = await preparedStatement.queryOne(["queriable%"]);
  assertEquals(resultQueryOne, { testcol: "queriable 1" });

  const resultQueryMany = await Array.fromAsync(
    preparedStatement.queryMany(["queriable%"]),
  );
  assertEquals(resultQueryMany, [
    { testcol: "queriable 1" },
    { testcol: "queriable 2" },
    { testcol: "queriable 3" },
  ]);

  const resultQueryArray = await preparedStatement.queryArray(["queriable%"]);
  assertEquals(resultQueryArray, [
    ["queriable 1"],
    ["queriable 2"],
    ["queriable 3"],
  ]);

  const resultQueryOneArray = await preparedStatement.queryOneArray([
    "queriable%",
  ]);
  assertEquals(resultQueryOneArray, ["queriable 1"]);

  const resultQueryManyArray = await Array.fromAsync(
    preparedStatement.queryManyArray(["queriable%"]),
  );
  assertEquals(resultQueryManyArray, [
    ["queriable 1"],
    ["queriable 2"],
    ["queriable 3"],
  ]);
}

async function testPreparable(
  preparable: SqlitePreparable,
): Promise<void> {
  // Testing properties
  isSqlPreparable(preparable);

  // Testing inherited classes
  await testQueriable(preparable);

  // Testing methods
  const prepared = preparable.prepare(
    "SELECT * FROM sqltesttable WHERE testcol LIKE ?",
  );
  await testPreparedStatement(prepared);
}
async function testTransaction(
  transaction: SqliteTransaction,
): Promise<void> {
  // Testing properties
  isSqlTransaction(transaction);

  // Testing inherited classes
  await testPreparable(transaction);
}
async function testTransactionable(
  transactionable: SqliteTransactionable,
): Promise<void> {
  // Testing properties
  isSqlTransactionable(transactionable);

  // Testing inherited classes
  await testPreparable(transactionable);

  // Testing methods
  const transaction = await transactionable.beginTransaction();
  await testTransaction(transaction);
}
