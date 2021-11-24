import {
  SQLITE3_DONE,
  SQLITE3_OPEN_CREATE,
  SQLITE3_OPEN_READONLY,
  SQLITE3_OPEN_READWRITE,
  SQLITE3_ROW,
  SQLITE_BLOB,
  SQLITE_FLOAT,
  SQLITE_INTEGER,
  SQLITE_NULL,
  SQLITE_TEXT,
} from "./constants.ts";
import {
  sqlite3,
  sqlite3_bind_double,
  sqlite3_bind_int,
  sqlite3_bind_int64,
  sqlite3_bind_null,
  sqlite3_bind_parameter_count,
  sqlite3_bind_parameter_index,
  sqlite3_bind_parameter_name,
  sqlite3_bind_text,
  sqlite3_close_v2,
  sqlite3_column_blob,
  sqlite3_column_count,
  sqlite3_column_double,
  sqlite3_column_int,
  sqlite3_column_name,
  sqlite3_column_text,
  sqlite3_column_type,
  sqlite3_exec,
  sqlite3_finalize,
  sqlite3_open_v2,
  sqlite3_prepare_v3,
  sqlite3_reset,
  sqlite3_step,
  sqlite3_stmt,
} from "./ffi.ts";
import { cstr } from "./util.ts";

export interface DatabaseOpenOptions {
  /** Whether to open database only in read-only mode. By default, this is false. */
  readonly?: boolean;
  /** Whether to create a new database file at specified path if one does not exist already. By default this is true. */
  create?: boolean;
}

/**
 * A SQLite3 database connection.
 */
export class Database {
  #path: string;
  #handle: sqlite3;

  get path() {
    return this.#path;
  }

  /**
   * Returns the unsafe raw handle of the database connection.
   * It is a pointer (u64) transmuted as f64.
   */
  get unsafeRawHandle() {
    return this.#handle;
  }

  constructor(path: string, options: DatabaseOpenOptions = {}) {
    this.#path = path;
    this.#handle = sqlite3_open_v2(
      path,
      options.readonly ? SQLITE3_OPEN_READONLY : (SQLITE3_OPEN_READWRITE |
        ((options.create ?? true) ? SQLITE3_OPEN_CREATE : 0)),
    );
  }

  /** Simply executes the SQL, without returning anything. */
  execute(sql: string) {
    sqlite3_exec(this.#handle, sql);
  }

  /** Creates a new prepared statement. */
  prepare(sql: string) {
    return new PreparedStatement(this, sqlite3_prepare_v3(this.#handle, sql));
  }

  queryArray<T extends unknown[] = any[]>(sql: string, ...args: unknown[]) {
    const stmt = this.prepare(sql);
    for (const i in args) {
      stmt.bind(Number(i), args[i]);
    }
    const rows = [];
    for (const row of stmt) {
      rows.push(row.asArray());
    }
    stmt.finalize();
    return rows as T[];
  }

  queryObject<T extends Record<string, unknown> = Record<string, any>>(
    sql: string,
    ...args: unknown[]
  ) {
    const stmt = this.prepare(sql);
    for (const i in args) {
      stmt.bind(Number(i), args[i]);
    }
    const rows = [];
    for (const row of stmt) {
      rows.push(row.asObject());
    }
    stmt.finalize();
    return rows as T[];
  }

  /**
   * Closes the database connection.
   *
   * Calling this method more than once is no-op.
   */
  close() {
    sqlite3_close_v2(this.#handle);
  }
}

export enum StepResult {
  ROW = SQLITE3_ROW,
  DONE = SQLITE3_DONE,
}

export enum SqliteType {
  NULL = SQLITE_NULL,
  INTEGER = SQLITE_INTEGER,
  FLOAT = SQLITE_FLOAT,
  TEXT = SQLITE_TEXT,
  BLOB = SQLITE_BLOB,
}

export class Row {
  #stmt: PreparedStatement;

  constructor(stmt: PreparedStatement) {
    this.#stmt = stmt;
  }

  get length() {
    return this.#stmt.columnCount;
  }

  get columns(): string[] {
    const cols = new Array(this.length);
    for (let i = 0; i < this.length; i++) {
      cols[i] = this.#stmt.columnName(i);
    }
    return cols;
  }

  asArray<T extends unknown[] = any[]>() {
    const array = new Array(this.#stmt.columnCount);
    for (let i = 0; i < this.#stmt.columnCount; i++) {
      array[i] = this.#stmt.column(i);
    }
    return array as T;
  }

  asObject<T extends Record<string, unknown> = Record<string, any>>(): T {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < this.#stmt.columnCount; i++) {
      const name = this.#stmt.columnName(i);
      obj[name] = this.#stmt.column(i);
    }
    return obj as T;
  }
}

export class PreparedStatement {
  #db: Database;
  #handle: sqlite3_stmt;
  #row = new Row(this);

  get db() {
    return this.#db;
  }

  get unsafeRawHandle() {
    return this.#handle;
  }

  /** Current row */
  get row() {
    return this.#row;
  }

  constructor(db: Database, handle: sqlite3_stmt) {
    this.#db = db;
    this.#handle = handle;
  }

  get bindParameterCount() {
    return sqlite3_bind_parameter_count(this.#handle);
  }

  bindParameterName(index: number) {
    return sqlite3_bind_parameter_name(this.#handle, index);
  }

  bindParameterIndex(name: string) {
    return sqlite3_bind_parameter_index(this.#handle, name);
  }

  bind(param: number | string, value: unknown) {
    const index = typeof param === "number"
      ? param
      : this.bindParameterIndex(param);

    switch (typeof value) {
      case "number":
        if (Number.isInteger(value)) {
          if (value <= 2 ** 32) {
            sqlite3_bind_int(
              this.db.unsafeRawHandle,
              this.#handle,
              index,
              value,
            );
          } else {
            sqlite3_bind_int64(
              this.db.unsafeRawHandle,
              this.#handle,
              index,
              BigInt(value),
            );
          }
        } else {
          sqlite3_bind_double(
            this.db.unsafeRawHandle,
            this.#handle,
            index,
            value,
          );
        }
        break;

      case "object":
        if (value === null) {
          sqlite3_bind_null(this.db.unsafeRawHandle, this.#handle, index);
        } else {
          throw new TypeError("Unsupported object type");
        }
        break;

      case "bigint":
        sqlite3_bind_int64(
          this.db.unsafeRawHandle,
          this.#handle,
          index,
          value,
        );
        break;

      case "string":
        sqlite3_bind_text(
          this.db.unsafeRawHandle,
          this.#handle,
          index + 1,
          cstr(value),
          value.length,
        );
        break;

      case "boolean":
        sqlite3_bind_int(
          this.db.unsafeRawHandle,
          this.#handle,
          index,
          value ? 1 : 0,
        );
        break;

      default:
        throw new TypeError(`Unsupported type: ${typeof value}`);
    }
  }

  get columnCount() {
    return sqlite3_column_count(this.#handle);
  }

  columnType(index: number): SqliteType {
    return sqlite3_column_type(this.#handle, index);
  }

  columnName(index: number) {
    return sqlite3_column_name(this.#handle, index);
  }

  column(index: number) {
    switch (this.columnType(index)) {
      case SqliteType.NULL:
        return null;

      case SqliteType.INTEGER:
        return sqlite3_column_int(this.#handle, index);

      case SqliteType.FLOAT:
        return sqlite3_column_double(this.#handle, index);

      case SqliteType.TEXT:
        return sqlite3_column_text(this.#handle, index);

      case SqliteType.BLOB:
        return sqlite3_column_blob(this.#handle, index);

      default:
        throw new Error(`Unsupported column type: ${this.columnType(index)}`);
    }
  }

  /**
   * @returns Row if available, undefined if done. Do note that Row object is shared for each Prepared
   * statement. So if you call step again the Row object will work for next row instead.
   */
  step() {
    if (sqlite3_step(this.#db.unsafeRawHandle, this.#handle) === SQLITE3_ROW) {
      return this.row;
    }
  }

  reset() {
    sqlite3_reset(this.#db.unsafeRawHandle, this.#handle);
  }

  finalize() {
    sqlite3_finalize(this.#db.unsafeRawHandle, this.#handle);
  }

  execute(...args: unknown[]) {
    for (const arg in args) {
      this.bind(Number(arg), args[arg]);
    }
    this.step();
    this.reset();
  }

  *[Symbol.iterator]() {
    let row;
    while ((row = this.step())) {
      yield row;
    }
  }
}
