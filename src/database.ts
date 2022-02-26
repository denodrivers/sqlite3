import {
  SQLITE3_OPEN_CREATE,
  SQLITE3_OPEN_MEMORY,
  SQLITE3_OPEN_READONLY,
  SQLITE3_OPEN_READWRITE,
} from "./constants.ts";
import {
  sqlite3,
  sqlite3_blob_open,
  sqlite3_changes,
  sqlite3_close_v2,
  sqlite3_complete,
  sqlite3_exec,
  sqlite3_get_autocommit,
  sqlite3_last_insert_rowid,
  sqlite3_libversion,
  sqlite3_open_v2,
  sqlite3_prepare_v2,
  sqlite3_sourceid,
  sqlite3_total_changes,
} from "./ffi.ts";
import { isObject } from "./util.ts";
import { fromFileUrl } from "../deps.ts";
import { PreparedStatement } from "./statement.ts";
import { SQLBlob } from "./blob.ts";

/** Types that can be possibly deserialized from SQLite Column */
export type ColumnValue = string | number | bigint | Uint8Array | null;
/** Types that can be possibly serialized as SQLite bind values */
export type BindValue =
  | number
  | string
  | symbol
  | bigint
  | boolean
  | null
  | undefined
  | Date
  | Uint8Array;

/** SQLite version string */
export const SQLITE_VERSION = sqlite3_libversion();
/** SQLite source ID string */
export const SQLITE_SOURCEID = sqlite3_sourceid();

/**
 * @param statement SQL statement string
 * @returns Whether the statement is complete
 */
export function isComplete(statement: string): boolean {
  return sqlite3_complete(statement);
}

/** Various options that can be configured when opening Database connection. */
export interface DatabaseOpenOptions {
  /** Whether to open database only in read-only mode. By default, this is false. */
  readonly?: boolean;
  /** Whether to create a new database file at specified path if one does not exist already. By default this is true. */
  create?: boolean;
  /** Raw SQLite C API flags. Specifying this ignores all other options. */
  flags?: number;
  /** Opens an in-memory database. */
  memory?: boolean;
}

export interface BlobOpenOptions {
  /** Whether to open Blob in readonly mode. True by default. */
  readonly?: boolean;
  /** Database to open Blob from, "main" by default. */
  db?: string;
  /** Table the Blob is in */
  table: string;
  /** Column name of the Blob Field */
  column: string;
  /** Row ID of which column to select */
  row: number;
}

/**
 * Represents a SQLite3 database connection.
 *
 * Example:
 * ```ts
 * // Open a database from file, creates if doesn't exist.
 * const db = new Database("myfile.db");
 * // Open an in-memory database.
 * const db = new Database(":memory:");
 * // Open a read-only database.
 * const db = new Database("myfile.db", { readonly: true });
 * ```
 */
export class Database {
  #path: string;
  #handle: sqlite3;

  /** Path of the database file. */
  get path(): string {
    return this.#path;
  }

  /** Unsafe Raw (pointer) to the sqlite object */
  get unsafeRawHandle(): Deno.UnsafePointer {
    return this.#handle;
  }

  /** Number of rows changed by the last executed statement. */
  get changes(): number {
    return sqlite3_changes(this.#handle);
  }

  /** Number of rows changed since the database connection was opened. */
  get totalChanges(): number {
    return sqlite3_total_changes(this.#handle);
  }

  /** Gets last inserted Row ID */
  get lastInsertRowId(): number {
    return sqlite3_last_insert_rowid(this.#handle);
  }

  /** Whether autocommit is enabled. Enabled by default, cab be disabled using BEGIN statement. */
  get autocommit(): boolean {
    return sqlite3_get_autocommit(this.#handle);
  }

  constructor(path: string | URL, options: DatabaseOpenOptions = {}) {
    this.#path = path instanceof URL ? fromFileUrl(path) : path;
    let flags = 0;
    if (options.flags !== undefined) {
      flags = options.flags;
    } else {
      if (options.memory === true) {
        flags |= SQLITE3_OPEN_MEMORY;
      }

      if (options.readonly === true) {
        flags |= SQLITE3_OPEN_READONLY;
      } else {
        flags |= SQLITE3_OPEN_READWRITE;
      }

      if (options.create !== false) {
        flags |= SQLITE3_OPEN_CREATE;
      }
    }

    this.#handle = sqlite3_open_v2(this.#path, flags);
  }

  /**
   * Simply executes the SQL, without returning anything.
   *
   * Example:
   * ```ts
   * // Create table
   * db.execute("create table users (id integer not null, username varchar(20) not null)");
   *
   * // Inserts
   * db.execute("insert into users (id, username) values(?, ?)", id, username);
   *
   * // Or run SQL safely using Template Strings!
   * db.execute`insert into users (id, username) values(${id}, ${username})`;
   *
   * // Insert with named parameters
   * db.execute("insert into users (id, username) values(:id, :username)", { id, username });
   *
   * // Pragma statements
   * db.execute("pragma journal_mode = WAL");
   * db.execute("pragma synchronous = normal");
   * db.execute("pragma temp_store = memory");
   * ```
   *
   * Under the hood, it uses `sqlite3_exec` if no parameters are given to bind
   * with the SQL statement, a prepared statement otherwise.
   */
  execute(strings: TemplateStringsArray, ...args: BindValue[]): void;
  execute(sql: string, ...args: BindValue[]): void;
  execute(sql: string, args: Record<string, BindValue>): void;
  execute(
    sql: string | TemplateStringsArray,
    ...args: BindValue[] | [Record<string, BindValue>]
  ): void {
    const sqlStr = typeof sql === "string" ? sql : sql.join("?");
    if (args.length) {
      const stmt = this.prepare(sqlStr);
      if (isObject(args[0])) {
        stmt.bindAllNamed(args[0] as Record<string, BindValue>);
      } else {
        stmt.bindAll(...args as BindValue[]);
      }
      stmt.step();
      stmt.finalize();
    } else sqlite3_exec(this.#handle, sqlStr);
  }

  /**
   * Creates a new prepared statement.
   *
   * Example:
   * ```ts
   * const stmt = db.prepare("insert into users (id, username) values (?, ?)");
   *
   * for (const user of usersToInsert) {
   *   stmt.execute(id, user);
   * }
   *
   * stmt.finalize();
   * ```
   *
   * @param sql SQL string for prepared query.
   * @returns A `PreparedStatement` object, on which you can call `execute` multiple
   * times and then `finalize` it.
   */
  prepare(sql: string): PreparedStatement {
    const handle = sqlite3_prepare_v2(this.#handle, sql);
    return new PreparedStatement(this, handle);
  }

  /**
   * Runs an SQL query with given parameters, and returns rows as array of columns.
   * If you need the rows as objects, use `queryObject` instead. However, it is
   * recommended to use `queryArray` because of the extra overhead added by FFI
   * calls to get column names to create row objects.
   *
   * Example:
   * ```ts
   * const users = db.queryArray<[number, string]>("select id, username from users");
   *
   * // Using bind parameters
   * const [user] = db.queryArray<[number, string]>("select id, username from users where email = ?", email);
   *
   * // Using template strings
   * const [user] = db.queryArray<[number, string]>`select id, username from users where email = ${email}`;
   *
   * // Using named bind parameters
   * const [user] = db.queryArray<[number, string]>("select id, username from users where email = :email", { email });
   * ```
   *
   * @param sql SQL query to execute.
   * @param args Parameters to bind to the query.
   *
   * @returns Array of rows (where rows are containing array of columns).
   */
  queryArray<T extends unknown[] = any[]>(
    strings: TemplateStringsArray,
    ...args: BindValue[]
  ): T[];
  queryArray<T extends unknown[] = any[]>(
    sql: string,
    ...args: BindValue[]
  ): T[];
  queryArray<T extends unknown[] = any[]>(
    sql: string,
    args: Record<string, BindValue>,
  ): T[];
  queryArray<T extends unknown[] = any[]>(
    sql: string | TemplateStringsArray,
    ...args: BindValue[] | [Record<string, BindValue>]
  ): T[] {
    const stmt = this.prepare(typeof sql === "string" ? sql : sql.join("?"));
    if (isObject(args[0])) {
      stmt.bindAllNamed(args[0] as Record<string, BindValue>);
    } else {
      stmt.bindAll(...args as BindValue[]);
    }
    const rows = [];
    for (const row of stmt) {
      rows.push(row.asArray());
    }
    stmt.finalize();
    return rows as T[];
  }

  /**
   * Executes an SQL query and returns the rows as objects.
   *
   * Note: if you do not need the column names, consider calling `queryArray` instead.
   * As this method does an extra FFI call to get the column names, it is more expensive than `queryArray`.
   *
   * Example:
   * ```ts
   * const users = db.queryObject<{
   *   id: number,
   *   username: string,
   * }>("select id, username from users");
   *
   * // Using bind parameters
   * const [user] = db.queryObject<{
   *   id: number,
   *   username: string,
   * }>("select id, username from users where email = ?", email);
   *
   * // Using template strings
   * const [user] = db.queryObject<{
   *  id: number,
   *  username: string,
   * }>`select id, username from users where email = ${email}`;
   *
   * // Using named bind parameters
   * const [user] = db.queryObject<{
   *   id: number,
   *   username: string,
   * }>("select id, username from users where email = :email", { email });
   * ```
   *
   * @param sql SQL query to execute.
   * @param args Parameters to bind to the query.
   *
   * @returns Array of rows, where rows are objects mapping column names to values.
   */
  queryObject<T extends Record<string, unknown> = Record<string, any>>(
    strings: TemplateStringsArray,
    ...args: BindValue[]
  ): T[];
  queryObject<T extends Record<string, unknown> = Record<string, any>>(
    sql: string,
    ...args: BindValue[]
  ): T[];
  queryObject<T extends Record<string, unknown> = Record<string, any>>(
    sql: string,
    args: Record<string, BindValue>,
  ): T[];
  queryObject<T extends Record<string, unknown> = Record<string, any>>(
    sql: string | TemplateStringsArray,
    ...args: BindValue[] | [Record<string, BindValue>]
  ): T[] {
    const stmt = this.prepare(typeof sql === "string" ? sql : sql.join("?"));
    if (isObject(args[0])) {
      stmt.bindAllNamed(args[0] as Record<string, BindValue>);
    } else {
      stmt.bindAll(...args as BindValue[]);
    }
    const rows = [];
    for (const row of stmt) {
      rows.push(row.asObject());
    }
    stmt.finalize();
    return rows as T[];
  }

  /** Open a Blob for incremental I/O. */
  openBlob(options: BlobOpenOptions): SQLBlob {
    options = Object.assign({
      readonly: true,
      db: "main",
    }, options);
    const handle = sqlite3_blob_open(
      this.#handle,
      options.db!,
      options.table,
      options.column,
      options.row,
      options.readonly === false ? 1 : 0,
    );
    if (handle.value === 0n) {
      throw new Error("null blob handle");
    }
    return new SQLBlob(handle);
  }

  /**
   * Closes the database connection.
   *
   * Calling this method more than once is no-op.
   */
  close(): void {
    sqlite3_close_v2(this.#handle);
  }

  [Symbol.for("Deno.customInspect")](): string {
    return `SQLite3.Database { path: ${this.path} }`;
  }
}
