import {
  type SqlClientEventType,
  SqlCloseEvent,
  SqlConnectEvent,
  type SqlConnectionEventInit,
  SqlEventTarget,
} from "@stdext/sql";
import type {
  SqliteConnection,
  SqliteConnectionOptions,
} from "./connection.ts";

export class SqliteEventTarget extends SqlEventTarget<
  SqliteConnectionOptions,
  SqliteConnection,
  SqlClientEventType,
  SqliteConnectionEventInit,
  SqliteEvents
> {
}

export type SqliteConnectionEventInit = SqlConnectionEventInit<
  SqliteConnection
>;

export class SqliteConnectEvent
  extends SqlConnectEvent<SqliteConnectionEventInit> {}
export class SqliteCloseEvent
  extends SqlCloseEvent<SqliteConnectionEventInit> {}

export type SqliteEvents =
  | SqliteConnectEvent
  | SqliteCloseEvent;
