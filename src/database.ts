import {
  SQLITE3_OPEN_CREATE,
  SQLITE3_OPEN_MEMORY,
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
  sqlite3_bind_blob,
  sqlite3_bind_double,
  sqlite3_bind_int,
  sqlite3_bind_int64,
  sqlite3_bind_null,
  sqlite3_bind_parameter_count,
  sqlite3_bind_parameter_index,
  sqlite3_bind_parameter_name,
  sqlite3_bind_text,
  sqlite3_changes,
  sqlite3_close_v2,
  sqlite3_column_blob,
  sqlite3_column_bytes,
  sqlite3_column_count,
  sqlite3_column_double,
  sqlite3_column_int,
  sqlite3_column_name,
  sqlite3_column_text,
  sqlite3_column_type,
  sqlite3_exec,
  sqlite3_finalize,
  sqlite3_libversion,
  sqlite3_open_v2,
  sqlite3_prepare_v3,
  sqlite3_reset,
  sqlite3_step,
  sqlite3_stmt,
  sqlite3_total_changes,
} from "./ffi.ts";
import { cstr } from "./util.ts";

export const SQLITE_VERSION = sqlite3_libversion();

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

/**
 * A SQLite3 database connection.
 */
export class Database {
  #path: string;
  #handle: sqlite3;

  /** Path of the  */
  get path() {
    return this.#path;
  }

  /** Unsafe Raw (pointer) to the sqlite object */
  get unsafeRawHandle() {
    return this.#handle;
  }

  /**
   * Number of rows changed by the last executed statement.
   */
  get changes() {
    return sqlite3_changes(this.#handle);
  }

  /**
   * Number of rows changed since the database connection was opened.
   */
  get totalChanges() {
    return sqlite3_total_changes(this.#handle);
  }

  constructor(path: string, options: DatabaseOpenOptions = {}) {
    this.#path = path;
    this.#handle = sqlite3_open_v2(
      path,
      options.flags ??
        (options.readonly ? SQLITE3_OPEN_READONLY : (SQLITE3_OPEN_READWRITE |
          ((options.create ?? true) ? SQLITE3_OPEN_CREATE : 0) | (options.memory
            ? SQLITE3_OPEN_MEMORY
            : 0))),
    );
  }

  /** Simply executes the SQL, without returning anything. */
  execute(sql: string, ...args: unknown[]) {
    if (args.length) {
      const prep = this.prepare(sql);
      prep.bindAll(...args);
      prep.step();
      prep.finalize();
    } else sqlite3_exec(this.#handle, sql);
  }

  /** Creates a new prepared statement. */
  prepare(sql: string) {
    return new PreparedStatement(this, sqlite3_prepare_v3(this.#handle, sql));
  }

  /**
   * Runs an SQL query with given parameters.
   *
   * @param sql SQL query to execute.
   * @param args Parameters to bind to the query.
   *
   * @returns Array of rows (where rows are containing array of columns).
   */
  queryArray<T extends unknown[] = any[]>(sql: string, ...args: unknown[]) {
    const stmt = this.prepare(sql);
    stmt.bindAll(...args);
    const rows = [];
    for (const row of stmt) {
      rows.push(row.asArray());
    }
    stmt.finalize();
    return rows as T[];
  }

  /**
   * @param sql SQL query to execute.
   * @param args Parameters to bind to the query.
   *
   * @returns Array of rows, where rows are objects mapping column names to values.
   * Note: if you do not need the column names, consider calling `queryArray` instead.
   * As this method does an extra FFI call to get the column names, it is more expensive than `queryArray`.
   */
  queryObject<T extends Record<string, unknown> = Record<string, any>>(
    sql: string,
    ...args: unknown[]
  ) {
    const stmt = this.prepare(sql);
    stmt.bindAll(...args);
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

/**
 * SQLite 3 value types.
 */
export enum SqliteType {
  NULL = SQLITE_NULL,
  INTEGER = SQLITE_INTEGER,
  FLOAT = SQLITE_FLOAT,
  TEXT = SQLITE_TEXT,
  BLOB = SQLITE_BLOB,
}

/**
 * Represents the current Row in a Prepared Statement. Should not be created directly.
 * Use `PreparedStatement.row` or `Row` returned by `PreparedStatement.step()` instead.
 */
export class Row {
  #stmt: PreparedStatement;

  constructor(stmt: PreparedStatement) {
    this.#stmt = stmt;
  }

  /** Number of columns in the row. */
  get columnCount() {
    return this.#stmt.columnCount;
  }

  /** Returns the names of the columns in the row. */
  get columns(): string[] {
    const columnCount = this.columnCount;
    const cols = new Array(columnCount);
    for (let i = 0; i < columnCount; i++) {
      cols[i] = this.#stmt.columnName(i);
    }
    return cols;
  }

  /** Returns the row as array containing columns' values. */
  asArray<T extends unknown[] = any[]>() {
    const columnCount = this.columnCount;
    const array = new Array(columnCount);
    for (let i = 0; i < columnCount; i++) {
      array[i] = this.#stmt.column(i);
    }
    return array as T;
  }

  /** Returns the row as object with column names mapping to values. */
  asObject<T extends Record<string, unknown> = Record<string, any>>(): T {
    const columnCount = this.columnCount;
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columnCount; i++) {
      const name = this.#stmt.columnName(i);
      obj[name] = this.#stmt.column(i);
    }
    return obj as T;
  }
}

/**
 * Represents a prepared statement. Should only be created by `Database.prepare()`.
 */
export class PreparedStatement {
  #db: Database;
  #handle: sqlite3_stmt;
  #row = new Row(this);

  /** Database associated with the Prepared Statement */
  get db() {
    return this.#db;
  }

  /** Unsafe Raw Handle (pointer) to the sqlite_stmt object. */
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

  /** Binding parameter count in the prepared statement. */
  get bindParameterCount() {
    return sqlite3_bind_parameter_count(this.#handle);
  }

  /** Get name of a binding parameter by its index. */
  bindParameterName(index: number) {
    return sqlite3_bind_parameter_name(this.#handle, index);
  }

  /** Get index of a binding parameter by its name. */
  bindParameterIndex(name: string) {
    return sqlite3_bind_parameter_index(this.#handle, name);
  }

  /** Bind a parameter for the prepared query either by index or name. */
  bind(param: number | string, value: unknown) {
    const index = typeof param === "number"
      ? param
      : this.bindParameterIndex(param);

    switch (typeof value) {
      case "number":
        if (Number.isSafeInteger(value)) {
          if (value < 2 ** 32 / 2) {
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
        } else if (value instanceof Uint8Array) {
          sqlite3_bind_blob(
            this.db.unsafeRawHandle,
            this.#handle,
            index,
            value,
          );
        } else if (value instanceof Date) {
          this.bind(index, value.toISOString());
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
          index,
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

      case "undefined":
        this.bind(index, null);
        break;

      case "symbol":
        this.bind(index, value.description);
        break;

      default:
        throw new TypeError(`Unsupported type: ${typeof value}`);
    }
  }

  /**
   * Binds all parameters to the prepared statement. This is a shortcut for calling `bind()` for each parameter.
   */
  bindAll(...values: unknown[]) {
    for (let i = 0; i < values.length; i++) {
      this.bind(i + 1, values[i]);
    }
  }

  /** Column count in current row. */
  get columnCount() {
    return sqlite3_column_count(this.#handle);
  }

  /** Return the data type of the column at given index in current row. */
  columnType(index: number): SqliteType {
    return sqlite3_column_type(this.#handle, index);
  }

  /** Return the name of the column at given index in current row. */
  columnName(index: number) {
    return sqlite3_column_name(this.#handle, index);
  }

  /** Return value of a column at given index in current row. */
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

      case SqliteType.BLOB: {
        const blob = sqlite3_column_blob(this.#handle, index);
        const length = sqlite3_column_bytes(this.#handle, index);
        const data = new Uint8Array(length);
        new Deno.UnsafePointerView(blob).copyInto(data);
        return data;
      }

      default:
        throw new Error(`Unsupported column type: ${this.columnType(index)}`);
    }
  }

  /**
   * Adds a step to the prepared statement, using current bindings.
   *
   * @returns Row if available, undefined if done. Do note that Row object is shared for each Prepared
   * statement. So if you call step again the Row object will work for next row instead.
   */
  step() {
    if (sqlite3_step(this.#db.unsafeRawHandle, this.#handle) === SQLITE3_ROW) {
      return this.row;
    }
  }

  /** Resets the prepared statement to its initial state. */
  reset() {
    sqlite3_reset(this.#db.unsafeRawHandle, this.#handle);
  }

  /** Finalize and run the prepared statement. */
  finalize() {
    sqlite3_finalize(this.#db.unsafeRawHandle, this.#handle);
  }

  /** Adds another step to prepared statement to be executed. Don't forget to call `finalize`. */
  execute(...args: unknown[]) {
    this.bindAll(...args);
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
