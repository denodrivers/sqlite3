import { SqliteEventTarget } from "./events.ts";
import { testSqlEventTarget } from "@stdext/sql/testing";

Deno.test("event constructs", () => {
  testSqlEventTarget(new SqliteEventTarget());
});
