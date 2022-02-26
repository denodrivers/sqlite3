import {
  SQLITE3_ROW,
  SQLITE_BLOB,
  SQLITE_FLOAT,
  SQLITE_INTEGER,
  SQLITE_NULL,
  SQLITE_TEXT,
} from "./constants.ts";
import type { BindValue, ColumnValue, Database } from "./database.ts";
import {
  sqlite3_bind_blob,
  sqlite3_bind_double,
  sqlite3_bind_int,
  sqlite3_bind_int64,
  sqlite3_bind_parameter_count,
  sqlite3_bind_parameter_index,
  sqlite3_bind_parameter_name,
  sqlite3_bind_text,
  sqlite3_clear_bindings,
  sqlite3_column_blob,
  sqlite3_column_bytes,
  sqlite3_column_count,
  sqlite3_column_double,
  sqlite3_column_int64,
  sqlite3_column_name,
  sqlite3_column_text,
  sqlite3_column_type,
  sqlite3_expanded_sql,
  sqlite3_finalize,
  sqlite3_reset,
  sqlite3_sql,
  sqlite3_step,
  sqlite3_stmt,
  sqlite3_stmt_readonly,
} from "./ffi.ts";
import { encode, isObject } from "./util.ts";

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
  get columnCount(): number {
    return this.#stmt.columnCount;
  }

  /** Returns the names of the columns in the row. */
  get columns(): string[] {
    const columnCount = this.#stmt.columnCount;
    const cols = new Array(columnCount);
    for (let i = 0; i < columnCount; i++) {
      cols[i] = this.#stmt.columnName(i);
    }
    return cols;
  }

  /** Returns the row as array containing columns' values. */
  asArray<T extends unknown[] = any[]>(): T {
    const columnCount = this.#stmt.columnCount;
    const array = new Array(columnCount);
    for (let i = 0; i < columnCount; i++) {
      array[i] = this.#stmt.column(i);
    }
    return array as T;
  }

  /** Returns the row as object with column names mapping to values. */
  asObject<T extends Record<string, unknown> = Record<string, any>>(): T {
    const columnCount = this.#stmt.columnCount;
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columnCount; i++) {
      const name = this.#stmt.columnName(i);
      obj[name] = this.#stmt.column(i);
    }
    return obj as T;
  }

  [Symbol.for("Deno.customInspect")](): string {
    return `SQLite3.Row { ${this.columns.join(", ")} }`;
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
  get db(): Database {
    return this.#db;
  }

  /** Unsafe Raw Handle (pointer) to the sqlite_stmt object. */
  get unsafeRawHandle(): Deno.UnsafePointer {
    return this.#handle;
  }

  /** Current row */
  get row(): Row {
    return this.#row;
  }

  /** The SQL string that we passed when creating statement */
  get sql(): string {
    return sqlite3_sql(this.#handle)!;
  }

  /** SQL string including bindings */
  get expandedSql(): string {
    return sqlite3_expanded_sql(this.#handle)!;
  }

  /** Whether this statement doesn't make any direct changes to the DB */
  get readonly(): boolean {
    return sqlite3_stmt_readonly(this.#handle);
  }

  constructor(db: Database, handle: sqlite3_stmt) {
    this.#db = db;
    this.#handle = handle;
  }

  /** Binding parameter count in the prepared statement. */
  get bindParameterCount(): number {
    return sqlite3_bind_parameter_count(this.#handle);
  }

  /** Get name of a binding parameter by its index. */
  bindParameterName(index: number): string {
    return sqlite3_bind_parameter_name(this.#handle, index);
  }

  /** Get index of a binding parameter by its name. */
  bindParameterIndex(name: string): number {
    const index = sqlite3_bind_parameter_index(this.#handle, name);
    if (index === 0) {
      throw new Error(`Couldn't find index for '${name}'`);
    }
    return index;
  }

  /**
   * We need to store references to any type that involves passing pointers
   * to avoid V8's GC deallocating them before the statement is finalized.
   *
   * In SQLite C API, there is a callback that we can pass for such types
   * to deallocate only when they're not in use. But this is not possible
   * using Deno FFI. So we will just store references to them until `finalize`
   * is called.
   */
  #bufferRefs = new Set<Uint8Array>();

  /** Bind a parameter for the prepared query either by index or name. */
  bind(param: number | string, value: BindValue): void {
    const index = typeof param === "number"
      ? param
      : this.bindParameterIndex(param);

    switch (typeof value) {
      case "number":
        if (isNaN(value)) {
          this.bind(index, null);
        } else if (Number.isSafeInteger(value)) {
          if (value < 2 ** 32 / 2 && value > -(2 ** 32 / 2)) {
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
          // By default, SQLite sets non-binded values to null.
          // so this call is not needed.
          // sqlite3_bind_null(this.db.unsafeRawHandle, this.#handle, index);
        } else if (value instanceof Uint8Array) {
          this.#bufferRefs.add(value);
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

      case "string": {
        // Bind parameters do not need C string,
        // because we specify it's length.
        const buffer = encode(value);
        this.#bufferRefs.add(buffer);
        sqlite3_bind_text(
          this.db.unsafeRawHandle,
          this.#handle,
          index,
          buffer,
        );
        break;
      }

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
  bindAll(...values: BindValue[]): void {
    for (let i = 0; i < values.length; i++) {
      this.bind(i + 1, values[i]);
    }
  }

  bindAllNamed(values: Record<string, BindValue>): void {
    for (const name in values) {
      const index = this.bindParameterIndex(":" + name);
      this.bind(index, values[name]);
    }
  }

  #cachedColCount?: number;

  /** Column count in current row. */
  get columnCount(): number {
    if (this.#cachedColCount !== undefined) return this.#cachedColCount;
    return (this.#cachedColCount = sqlite3_column_count(this.#handle));
  }

  #colTypeCache = new Map<number, SqliteType>();

  /** Return the data type of the column at given index in current row. */
  columnType(index: number): SqliteType {
    if (this.#colTypeCache.has(index)) return this.#colTypeCache.get(index)!;
    const type = sqlite3_column_type(this.#handle, index);
    this.#colTypeCache.set(index, type);
    return type;
  }

  #colNameCache = new Map<number, string>();

  /** Return the name of the column at given index in current row. */
  columnName(index: number): string {
    if (this.#colNameCache.has(index)) return this.#colNameCache.get(index)!;
    const name = sqlite3_column_name(this.#handle, index);
    this.#colNameCache.set(index, name);
    return name;
  }

  /** Return value of a column at given index in current row. */
  column<T extends ColumnValue = ColumnValue>(index: number): T {
    switch (this.columnType(index)) {
      case SqliteType.INTEGER: {
        const value = sqlite3_column_int64(this.#handle, index);
        const num = Number(value);
        if (Number.isSafeInteger(num)) {
          return num as T;
        } else {
          return value as T;
        }
      }

      case SqliteType.FLOAT:
        return sqlite3_column_double(this.#handle, index) as T;

      case SqliteType.TEXT:
        return sqlite3_column_text(this.#handle, index) as T;

      case SqliteType.BLOB: {
        const blob = sqlite3_column_blob(this.#handle, index);
        if (blob.value === 0n) return null as T;
        const length = sqlite3_column_bytes(this.#handle, index);
        const data = new Uint8Array(length);
        new Deno.UnsafePointerView(blob).copyInto(data);
        return data as T;
      }

      default:
        return null as T;
    }
  }

  /**
   * Adds a step to the prepared statement, using current bindings.
   *
   * @returns Row if available, undefined if done. Do note that Row object is shared for each Prepared
   * statement. So if you call step again the Row object will work for next row instead.
   */
  step(): Row | undefined {
    if (sqlite3_step(this.#db.unsafeRawHandle, this.#handle) === SQLITE3_ROW) {
      return this.row;
    }
  }

  /** Resets the prepared statement to its initial state. */
  reset(): void {
    sqlite3_reset(this.#db.unsafeRawHandle, this.#handle);
  }

  /** Adds another step to prepared statement to be executed. Don't forget to call `finalize`. */
  execute(...args: BindValue[]): void;
  execute(args: Record<string, BindValue>): void;
  execute(...args: BindValue[] | [Record<string, BindValue>]): void {
    if (args.length === 1 && isObject(args[0])) {
      this.bindAllNamed(args[0] as Record<string, BindValue>);
    } else {
      this.bindAll(...args as BindValue[]);
    }
    this.step();
    this.reset();
  }

  /** Clears any previously set binding parameters to NULL */
  clearBindings(): void {
    sqlite3_clear_bindings(this.#db.unsafeRawHandle, this.#handle);
  }

  /**
   * Finalize and run the prepared statement.
   *
   * This also frees up any resources related to the statement.
   * And clears all references to the buffers as they're no longer
   * needed, allowing V8 to GC them.
   */
  finalize(): void {
    try {
      sqlite3_finalize(this.#db.unsafeRawHandle, this.#handle);
    } finally {
      this.#bufferRefs.clear();
      this.#colTypeCache.clear();
      this.#colNameCache.clear();
      this.#cachedColCount = undefined;
    }
  }

  /**
   * Returns an iterator for rows.
   */
  *[Symbol.iterator](): IterableIterator<Row> {
    let row;
    while ((row = this.step())) {
      yield row;
    }
  }
}
