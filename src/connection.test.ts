import { assert, assertEquals } from "@std/assert";
import { SqliteConnectable, SqliteConnection } from "./connection.ts";
import { _testSqlConnectable, testSqlConnection } from "@stdext/sql/testing";

Deno.test("connection and connectable contstructs", () => {
  const connection = new SqliteConnection(":memory:");
  testSqlConnection(connection, { connectionUrl: ":memory:" });
  const connectable = new SqliteConnectable(connection);
  _testSqlConnectable(connectable, connection);
});

Deno.test("connection can connect and query", async () => {
  await using connection = new SqliteConnection(":memory:");
  await connection.connect();
  assert(connection.connected, "connection should be connected");
  const executeResult = await connection.execute(`select 1 as one`);
  assertEquals(executeResult, 0);
  const queryManyResult = connection.queryMany(`select 1 as one`);
  const queryManyResultNext1 = await queryManyResult.next();
  assertEquals(queryManyResultNext1, { done: false, value: { one: 1 } });
  const queryManyResultNext2 = await queryManyResult.next();
  assertEquals(queryManyResultNext2, { done: true, value: undefined });
  const queryManyArrayResult = connection.queryManyArray(`select 1 as one`);
  const queryManyArrayResultNext1 = await queryManyArrayResult.next();
  assertEquals(queryManyArrayResultNext1, { done: false, value: [1] });
  const queryManyArrayResultNext2 = await queryManyArrayResult.next();
  assertEquals(queryManyArrayResultNext2, { done: true, value: undefined });
});
