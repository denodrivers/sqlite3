// deno-lint-ignore-file require-await
import type {
  ArrayRow,
  Row,
  SqlConnectable,
  SqlConnection,
  SqlConnectionOptions,
} from "@stdext/sql";
import { fromFileUrl } from "@std/path";
import ffi from "./ffi.ts";
import { Database, type DatabaseOpenOptions } from "../mod.ts";
import type { SqliteParameterType, SqliteQueryOptions } from "./core.ts";
import { transformToAsyncGenerator } from "./util.ts";

/** Various options that can be configured when opening Database connection. */
export interface SqliteConnectionOptions
  extends SqlConnectionOptions, DatabaseOpenOptions {
}

/**
 * Represents a SQLx based SQLite3 database connection.
 *
 * Example:
 * ```ts
 * // Open a database from file, creates if doesn't exist.
 * const db = new SqliteClient("myfile.db");
 *
 * // Open an in-memory database.
 * const db = new SqliteClient(":memory:");
 *
 * // Open a read-only database.
 * const db = new SqliteClient("myfile.db", { readonly: true });
 *
 * // Or open using File URL
 * const db = new SqliteClient(new URL("./myfile.db", import.meta.url));
 * ```
 */
export class SqliteConnection implements
  SqlConnection<
    SqliteConnectionOptions,
    SqliteParameterType,
    SqliteQueryOptions
  > {
  readonly connectionUrl: string;
  readonly options: SqliteConnectionOptions;

  /**
   * The FFI SQLite methods.
   */
  readonly ffi = ffi;

  _db: Database | null = null;

  get db(): Database {
    if (this._db === null) {
      throw new Error("Database connection is not open");
    }
    return this._db;
  }

  set db(value: Database | null) {
    this._db = value;
  }

  get connected(): boolean {
    return Boolean(this._db?.open);
  }

  constructor(
    connectionUrl: string | URL,
    options: SqliteConnectionOptions = {},
  ) {
    this.connectionUrl = connectionUrl instanceof URL
      ? fromFileUrl(connectionUrl)
      : connectionUrl;
    this.options = options;
  }

  async connect(): Promise<void> {
    this.db = new Database(this.connectionUrl, this.options);
  }

  async close(): Promise<void> {
    this._db?.close();
    this._db = null;
  }

  execute(
    sql: string,
    params?: SqliteParameterType[],
    _options?: SqliteQueryOptions,
  ): Promise<number | undefined> {
    return Promise.resolve(this.db.exec(sql, ...(params || [])));
  }
  queryMany<T extends Row<any> = Row<any>>(
    sql: string,
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions,
  ): AsyncGenerator<T, any, unknown> {
    return transformToAsyncGenerator(
      this.db.prepare(sql).getMany<T>(params, options),
    );
  }
  queryManyArray<T extends ArrayRow<any> = ArrayRow<any>>(
    sql: string,
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions,
  ): AsyncGenerator<T, any, unknown> {
    return transformToAsyncGenerator(
      this.db.prepare(sql).valueMany<T>(params, options),
    );
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  [Symbol.for("Deno.customInspect")](): string {
    return `SQLite3.SqliteConnection { path: ${this.connectionUrl} }`;
  }
}

export class SqliteConnectable implements
  SqlConnectable<
    SqliteConnectionOptions,
    SqliteConnection
  > {
  readonly connection: SqliteConnection;
  readonly options: SqliteConnectionOptions;
  get connected(): boolean {
    return this.connection.connected;
  }

  constructor(
    connection: SqliteConnectable["connection"],
    options: SqliteConnectable["options"] = {},
  ) {
    this.connection = connection;
    this.options = options;
  }
  [Symbol.asyncDispose](): Promise<void> {
    return this.connection.close();
  }
}
