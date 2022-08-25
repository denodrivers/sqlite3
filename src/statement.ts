import type { Database } from "./database.ts";
import { readCstr, toCString, unwrap } from "./util.ts";
import ffi from "./ffi.ts";
import {
  SQLITE3_DONE,
  SQLITE3_ROW,
  SQLITE_BLOB,
  SQLITE_FLOAT,
  SQLITE_INTEGER,
  SQLITE_TEXT,
} from "./constants.ts";

const {
  sqlite3_prepare_v2,
  sqlite3_reset,
  sqlite3_clear_bindings,
  sqlite3_step,
  sqlite3_column_count,
  sqlite3_column_type,
  sqlite3_column_text,
  sqlite3_finalize,
  sqlite3_column_int,
  sqlite3_column_double,
  sqlite3_column_blob,
  sqlite3_column_bytes,
  sqlite3_column_name,
  sqlite3_expanded_sql,
  sqlite3_bind_parameter_count,
  sqlite3_bind_int,
  sqlite3_bind_text,
  sqlite3_bind_blob,
  sqlite3_bind_double,
  sqlite3_bind_parameter_index,
  sqlite3_sql,
  sqlite3_stmt_readonly,
  sqlite3_bind_parameter_name,
} = ffi;

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

export type BindParameters = BindValue[] | Record<string, BindValue>;
export type RestBindParameters = BindValue[] | [BindParameters];

const statementFinalizer = new FinalizationRegistry((ptr: Deno.PointerValue) => {
  sqlite3_finalize(ptr);
});

/**
 * Represents a prepared statement.
 *
 * Must be `finalize`d after use to free the statement.
 */
export class Statement {
  #handle: Deno.PointerValue;

  /** Unsafe Raw (pointer) to the sqlite object */
  get unsafeHandle(): Deno.PointerValue {
    return this.#handle;
  }

  /** SQL string including bindings */
  get expandedSql(): string {
    return readCstr(sqlite3_expanded_sql(this.#handle));
  }

  /** The SQL string that we passed when creating statement */
  get sql(): string {
    return readCstr(sqlite3_sql(this.#handle));
  }

  /** Whether this statement doesn't make any direct changes to the DB */
  get readonly(): boolean {
    return sqlite3_stmt_readonly(this.#handle) !== 0;
  }

  /** Simply run the query without retrieving any output there may be. */
  run(...args: RestBindParameters): void {
    return this.#runWithArgs(...args);
  }

  /**
   * Run the query and return the resulting rows where rows are array of columns.
   */
  values<T extends unknown[] = any[]>(...args: RestBindParameters): T[] {
    return this.#valuesWithArgs(...args);
  }

  /**
   * Run the query and return the resulting rows where rows are objects
   * mapping column name to their corresponding values.
   */
  all<T extends Record<string, unknown> = Record<string, any>>(
    ...args: RestBindParameters
  ): T[] {
    return this.#allWithArgs(...args);
  }

  #bindParameterCount: number;

  get bindParameterCount(): number {
    return this.#bindParameterCount;
  }

  constructor(public db: Database, sql: string) {
    const pHandle = new Uint32Array(2);
    unwrap(
      sqlite3_prepare_v2(
        db.unsafeHandle,
        toCString(sql),
        sql.length,
        pHandle,
        0,
      ),
      db.unsafeHandle,
    );
    this.#handle = pHandle[0] + 2 ** 32 * pHandle[1];

    statementFinalizer.register(this, this.#handle);

    if (
      (this.#bindParameterCount = sqlite3_bind_parameter_count(
        this.#handle,
      )) === 0
    ) {
      this.all = this.#allNoArgs;
      this.values = this.#valuesNoArgs;
      this.run = this.#runNoArgs;
    }
  }

  bindParameterName(i: number): string {
    return readCstr(sqlite3_bind_parameter_name(this.#handle, i));
  }

  bindParameterIndex(name: string): number {
    if (name[0] !== ":" && name[0] !== "@") name = ":" + name;
    return sqlite3_bind_parameter_index(this.#handle, toCString(name));
  }

  #colNameCache: Record<number, string> = {};

  /** Return the name of the column at given index in current row. */
  columnName(index: number): string {
    const cached = this.#colNameCache[index];
    if (cached !== undefined) return cached;
    return (this.#colNameCache[index] = readCstr(
      readCstr(sqlite3_column_name(this.#handle, index)),
    ));
  }

  #cachedColCount?: number;

  /** Column count in current row. */
  get columnCount(): number {
    if (this.#cachedColCount !== undefined) return this.#cachedColCount;
    return (this.#cachedColCount = sqlite3_column_count(this.#handle));
  }

  #begin(): void {
    sqlite3_reset(this.#handle);
    sqlite3_clear_bindings(this.#handle);
    this.#cachedColCount = undefined;
    this.#colNameCache = {};
  }

  #getColumn(handle: number, i: number): any {
    const ty = sqlite3_column_type(handle, i);
    if (ty === SQLITE_INTEGER) return sqlite3_column_int(handle, i);
    switch (ty) {
      case SQLITE_TEXT: {
        const ptr = sqlite3_column_text(handle, i);
        if (ptr === 0) return null;
        return readCstr(ptr);
      }

      case SQLITE_INTEGER: {
        return sqlite3_column_int(handle, i);
      }

      case SQLITE_FLOAT: {
        return sqlite3_column_double(handle, i);
      }

      case SQLITE_BLOB: {
        const ptr = sqlite3_column_blob(handle, i);
        const bytes = sqlite3_column_bytes(handle, i);
        return new Uint8Array(
          new Deno.UnsafePointerView(BigInt(ptr)).getArrayBuffer(bytes)
            .slice(0),
        );
      }

      default: {
        return null;
      }
    }
  }

  #runNoArgs(): undefined {
    this.#begin();
    const status = sqlite3_step(this.#handle);
    if (status === SQLITE3_ROW || status === SQLITE3_DONE) {
      return undefined;
    } else {
      unwrap(status, this.db.unsafeHandle);
    }
  }

  #bind(i: number, param: BindValue): void {
    switch (typeof param) {
      case "number": {
        if (Number.isInteger(param)) {
          unwrap(sqlite3_bind_int(this.#handle, i + 1, param));
        } else {
          unwrap(sqlite3_bind_double(this.#handle, i + 1, param));
        }
        break;
      }
      case "string": {
        const str = (Deno as any).core.encode(param);
        unwrap(
          sqlite3_bind_text(this.#handle, i + 1, str, str.byteLength, 0),
        );
        break;
      }
      case "object": {
        if (param === null) {
          // pass
        } else if (param instanceof Uint8Array) {
          unwrap(
            sqlite3_bind_blob(
              this.#handle,
              i + 1,
              param,
              param.byteLength,
              0,
            ),
          );
        } else if (param instanceof Date) {
          unwrap(
            sqlite3_bind_text(
              this.#handle,
              i + 1,
              toCString(param.toISOString()),
              -1,
              0,
            ),
          );
        } else {
          throw new Error(`Value of unsupported type: ${Deno.inspect(param)}`);
        }
        break;
      }
      case "boolean":
        unwrap(sqlite3_bind_int(
          this.#handle,
          i + 1,
          param ? 1 : 0,
        ));
        break;
      default: {
        throw new Error(`Value of unsupported type: ${Deno.inspect(param)}`);
      }
    }
  }

  #bindAll(params: RestBindParameters | BindParameters): void {
    if (
      typeof params[0] === "object" && params[0] !== null &&
      !(params[0] instanceof Uint8Array) && !(params[0] instanceof Date)
    ) {
      params = params[0];
    }
    if (Array.isArray(params)) {
      for (let i = 0; i < params.length; i++) {
        this.#bind(i, (params as BindValue[])[i]);
      }
    } else {
      for (const [name, param] of Object.entries(params)) {
        const i = this.bindParameterIndex(name);
        if (i === 0) {
          throw new Error(`No such parameter "${name}"`);
        }
        this.#bind(i - 1, param as BindValue);
      }
    }
  }

  #runWithArgs(...params: RestBindParameters): undefined {
    this.#begin();
    this.#bindAll(params);
    const status = sqlite3_step(this.#handle);
    if (status === SQLITE3_ROW || status === SQLITE3_DONE) {
      return undefined;
    } else {
      unwrap(status, this.db.unsafeHandle);
    }
  }

  #valuesNoArgs<T extends Array<unknown>>(): T[] {
    this.#begin();
    const columnCount = sqlite3_column_count(this.#handle);
    const result: T[] = [];
    const getRowArray = new Function(
      "getColumn",
      `
      return function() {
        return [${
        Array.from({ length: columnCount }).map((_, i) =>
          `getColumn(${this.#handle}, ${i})`
        )
          .join(", ")
      }];
      };
      `,
    )(this.#getColumn.bind(this));
    let status = sqlite3_step(this.#handle);
    while (status === SQLITE3_ROW) {
      result.push(getRowArray());
      status = sqlite3_step(this.#handle);
    }
    if (status !== SQLITE3_DONE) {
      unwrap(status, this.db.unsafeHandle);
    }
    return result as T[];
  }

  #valuesWithArgs<T extends Array<unknown>>(
    ...params: RestBindParameters
  ): T[] {
    this.#begin();
    this.#bindAll(params);
    const columnCount = sqlite3_column_count(this.#handle);
    const result: T[] = [];
    const getRowArray = new Function(
      "getColumn",
      `
      return function() {
        return [${
        Array.from({ length: columnCount }).map((_, i) =>
          `getColumn(${this.#handle}, ${i})`
        )
          .join(", ")
      }];
      };
      `,
    )(this.#getColumn.bind(this));
    let status = sqlite3_step(this.#handle);
    while (status === SQLITE3_ROW) {
      result.push(getRowArray());
      status = sqlite3_step(this.#handle);
    }
    if (status !== SQLITE3_DONE) {
      unwrap(status, this.db.unsafeHandle);
    }
    return result as T[];
  }

  #allNoArgs<T extends Record<string, unknown>>(): T[] {
    this.#begin();
    const columnCount = sqlite3_column_count(this.#handle);
    const columnNames = new Array(columnCount);
    for (let i = 0; i < columnCount; i++) {
      columnNames[i] = readCstr(sqlite3_column_name(this.#handle, i));
    }
    const result: T[] = [];
    const getRowObject = new Function(
      "getColumn",
      `
      return function() {
        return {
          ${
        columnNames.map((name, i) =>
          `"${name}": getColumn(${this.#handle}, ${i})`
        ).join(",\n")
      }
        };
      };
      `,
    )(this.#getColumn.bind(this));
    let status = sqlite3_step(this.#handle);
    while (status === SQLITE3_ROW) {
      result.push(getRowObject());
      status = sqlite3_step(this.#handle);
    }
    if (status !== SQLITE3_DONE) {
      unwrap(status, this.db.unsafeHandle);
    }
    return result as T[];
  }

  #allWithArgs<T extends Record<string, unknown>>(
    ...params: RestBindParameters
  ): T[] {
    this.#begin();
    this.#bindAll(params);
    const columnCount = sqlite3_column_count(this.#handle);
    const columnNames = new Array(columnCount);
    for (let i = 0; i < columnCount; i++) {
      columnNames[i] = readCstr(sqlite3_column_name(this.#handle, i));
    }
    const result: T[] = [];
    const getRowObject = new Function(
      "getColumn",
      `
      return function() {
        return {
          ${
        columnNames.map((name, i) =>
          `"${name}": getColumn(${this.#handle}, ${i})`
        ).join(",\n")
      }
        };
      };
      `,
    )(this.#getColumn.bind(this));
    let status = sqlite3_step(this.#handle);
    while (status === SQLITE3_ROW) {
      result.push(getRowObject());
      status = sqlite3_step(this.#handle);
    }
    if (status !== SQLITE3_DONE) {
      unwrap(status, this.db.unsafeHandle);
    }
    return result as T[];
  }

  #arr: any[] = [];

  #getPreArray<T>(): T[] {
    if (this.#cachedColCount !== undefined) return this.#arr;
    this.#cachedColCount = sqlite3_column_count(this.#handle);
    return (this.#arr = new Array(this.#cachedColCount));
  }

  get<T extends Array<unknown>>(): T | undefined {
    const handle = this.#handle;
    const arr = this.#getPreArray<T>();

    sqlite3_reset(handle);
    const status = sqlite3_step(handle);
    if (status === SQLITE3_ROW) {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = this.#getColumn(handle as number, i);
      }

      return arr as T;
    } else if (status === SQLITE3_DONE) {
      return;
    } else {
      unwrap(status, this.db.unsafeHandle);
    }
  }

  finalize(): void {
    unwrap(sqlite3_finalize(this.#handle));
  }

  // https://www.sqlite.org/capi3ref.html#sqlite3_expanded_sql
  toString(): string {
    return readCstr(sqlite3_expanded_sql(this.#handle));
  }
}
