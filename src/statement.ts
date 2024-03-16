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
  sqlite3_column_value,
  sqlite3_value_subtype,
  sqlite3_column_text,
  sqlite3_finalize,
  sqlite3_column_int64,
  sqlite3_column_double,
  sqlite3_column_blob,
  sqlite3_column_bytes,
  sqlite3_column_name,
  sqlite3_expanded_sql,
  sqlite3_bind_parameter_count,
  sqlite3_bind_int,
  sqlite3_bind_int64,
  sqlite3_bind_text,
  sqlite3_bind_blob,
  sqlite3_bind_double,
  sqlite3_bind_parameter_index,
  sqlite3_sql,
  sqlite3_stmt_readonly,
  sqlite3_bind_parameter_name,
  sqlite3_changes,
  sqlite3_column_int,
  sqlite3_step_cb,
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
  | Uint8Array
  | BindValue[]
  | { [key: string]: BindValue };

export type BindParameters = BindValue[] | Record<string, BindValue>;
export type RestBindParameters = BindValue[] | [BindParameters];

/** Maps sqlite_stmt* pointers to sqlite* db pointers. */
export const STATEMENTS_TO_DB = new Map<Deno.PointerValue, Deno.PointerValue>();

const emptyStringBuffer = new Uint8Array(1);

const statementFinalizer = new FinalizationRegistry(
  (ptr: Deno.PointerValue) => {
    if (STATEMENTS_TO_DB.has(ptr)) {
      sqlite3_finalize(ptr);
      STATEMENTS_TO_DB.delete(ptr);
    }
  },
);

// https://github.com/sqlite/sqlite/blob/195611d8e6fc0bba559a49e91e6ceb42e4bdd6ba/src/json.c#L125-L126
const JSON_SUBTYPE = 74;

function getColumn(handle: Deno.PointerValue, i: number, int64: boolean): any {
  const ty = sqlite3_column_type(handle, i);

  if (ty === SQLITE_INTEGER && !int64) return sqlite3_column_int(handle, i);

  switch (ty) {
    case SQLITE_TEXT: {
      const ptr = sqlite3_column_text(handle, i);
      if (ptr === null) return null;
      const text = readCstr(ptr, 0);
      const value = sqlite3_column_value(handle, i);
      const subtype = sqlite3_value_subtype(value);
      if (subtype === JSON_SUBTYPE) {
        try {
          return JSON.parse(text);
        } catch (_error) {
          return text;
        }
      }
      return text;
    }

    case SQLITE_INTEGER: {
      return sqlite3_column_int64(handle, i);
    }

    case SQLITE_FLOAT: {
      return sqlite3_column_double(handle, i);
    }

    case SQLITE_BLOB: {
      const ptr = sqlite3_column_blob(handle, i);
      
      if (ptr === null) {
        return new Uint8Array();
      }

      const bytes = sqlite3_column_bytes(handle, i);
      return new Uint8Array(
        Deno.UnsafePointerView.getArrayBuffer(ptr, bytes).slice(0),
      );
    }

    default: {
      return null;
    }
  }
}

/**
 * Represents a prepared statement.
 *
 * See `Database#prepare` for more information.
 */
export class Statement {
  #handle: Deno.PointerValue;
  #finalizerToken: { handle: Deno.PointerValue };
  #bound = false;
  #hasNoArgs = false;
  #unsafeConcurrency;

  /**
   * Whether the query might call into JavaScript or not.
   *
   * Must enable if the query makes use of user defined functions,
   * otherwise there can be V8 crashes.
   *
   * Off by default. Causes performance degradation.
   */
  callback = false;

  /** Unsafe Raw (pointer) to the sqlite object */
  get unsafeHandle(): Deno.PointerValue {
    return this.#handle;
  }

  /** SQL string including bindings */
  get expandedSql(): string {
    return readCstr(sqlite3_expanded_sql(this.#handle)!);
  }

  /** The SQL string that we passed when creating statement */
  get sql(): string {
    return readCstr(sqlite3_sql(this.#handle)!);
  }

  /** Whether this statement doesn't make any direct changes to the DB */
  get readonly(): boolean {
    return sqlite3_stmt_readonly(this.#handle) !== 0;
  }

  /** Simply run the query without retrieving any output there may be. */
  run(...args: RestBindParameters): number {
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

  /** Number of parameters (to be) bound */
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
        null,
      ),
      db.unsafeHandle,
    );
    this.#handle = Deno.UnsafePointer.create(pHandle[0] + 2 ** 32 * pHandle[1]);
    STATEMENTS_TO_DB.set(this.#handle, db.unsafeHandle);
    this.#unsafeConcurrency = db.unsafeConcurrency;
    this.#finalizerToken = { handle: this.#handle };
    statementFinalizer.register(this, this.#handle, this.#finalizerToken);

    if (
      (this.#bindParameterCount = sqlite3_bind_parameter_count(
        this.#handle,
      )) === 0
    ) {
      this.#hasNoArgs = true;
      this.all = this.#allNoArgs;
      this.values = this.#valuesNoArgs;
      this.run = this.#runNoArgs;
      this.value = this.#valueNoArgs;
      this.get = this.#getNoArgs;
    }
  }

  /** Shorthand for `this.callback = true`. Enables calling user defined functions. */
  enableCallback(): this {
    this.callback = true;
    return this;
  }

  /** Get bind parameter name by index */
  bindParameterName(i: number): string {
    return readCstr(sqlite3_bind_parameter_name(this.#handle, i)!);
  }

  /** Get bind parameter index by name */
  bindParameterIndex(name: string): number {
    if (name[0] !== ":" && name[0] !== "@" && name[0] !== "$") {
      name = ":" + name;
    }
    return sqlite3_bind_parameter_index(this.#handle, toCString(name));
  }

  #begin(): void {
    sqlite3_reset(this.#handle);
    if (!this.#bound && !this.#hasNoArgs) {
      sqlite3_clear_bindings(this.#handle);
      this.#bindRefs.clear();
    }
  }

  #bindRefs: Set<any> = new Set();

  #bind(i: number, param: BindValue): void {
    switch (typeof param) {
      case "number": {
        if (Number.isInteger(param)) {
          if (
            Number.isSafeInteger(param) && param >= -(2 ** 31) &&
            param < 2 ** 31
          ) {
            unwrap(sqlite3_bind_int(this.#handle, i + 1, param));
          } else {
            unwrap(sqlite3_bind_int64(this.#handle, i + 1, BigInt(param)));
          }
        } else {
          unwrap(sqlite3_bind_double(this.#handle, i + 1, param));
        }
        break;
      }
      case "string": {
        if (param === "") {
          // Empty string is encoded as empty buffer in Deno. And as of
          // right now (Deno 1.29.1), ffi layer converts it to NULL pointer,
          // which causes sqlite3_bind_text to bind the NULL value instead
          // of an empty string. As a workaround let's use a special
          // non-empty buffer, but specify zero length.
          unwrap(
            sqlite3_bind_text(this.#handle, i + 1, emptyStringBuffer, 0, null),
          );
        } else {
          const str = new TextEncoder().encode(param);
          this.#bindRefs.add(str);
          unwrap(
            sqlite3_bind_text(this.#handle, i + 1, str, str.byteLength, null),
          );
        }
        break;
      }
      case "object": {
        if (param === null) {
          // pass
        } else if (param instanceof Uint8Array) {
          this.#bindRefs.add(param);
          unwrap(
            sqlite3_bind_blob(
              this.#handle,
              i + 1,
              param,
              param.byteLength,
              null,
            ),
          );
        } else if (param instanceof Date) {
          const cstring = toCString(param.toISOString());
          this.#bindRefs.add(cstring);
          unwrap(
            sqlite3_bind_text(
              this.#handle,
              i + 1,
              cstring,
              -1,
              null,
            ),
          );
        } else {
          const cstring = toCString(JSON.stringify(param));
          this.#bindRefs.add(cstring);
          unwrap(
            sqlite3_bind_text(
              this.#handle,
              i + 1,
              cstring,
              -1,
              null,
            ),
          );
        }
        break;
      }

      case "bigint": {
        unwrap(sqlite3_bind_int64(this.#handle, i + 1, param));
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

  /**
   * Bind parameters to the statement. This method can only be called once
   * to set the parameters to be same throughout the statement. You cannot
   * change the parameters after this method is called.
   *
   * This method is merely just for optimization to avoid binding parameters
   * each time in prepared statement.
   */
  bind(...params: RestBindParameters): this {
    this.#bindAll(params);
    this.#bound = true;
    return this;
  }

  #bindAll(params: RestBindParameters | BindParameters): void {
    if (this.#bound) throw new Error("Statement already bound to values");
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

  #runNoArgs(): number {
    const handle = this.#handle;
    this.#begin();
    let status;
    if (this.callback) {
      status = sqlite3_step_cb(handle);
    } else {
      status = sqlite3_step(handle);
    }
    if (status !== SQLITE3_ROW && status !== SQLITE3_DONE) {
      unwrap(status, this.db.unsafeHandle);
    }
    sqlite3_reset(handle);
    return sqlite3_changes(this.db.unsafeHandle);
  }

  #runWithArgs(...params: RestBindParameters): number {
    const handle = this.#handle;
    this.#begin();
    this.#bindAll(params);
    let status;
    if (this.callback) {
      status = sqlite3_step_cb(handle);
    } else {
      status = sqlite3_step(handle);
    }
    if (!this.#hasNoArgs && !this.#bound && params.length) {
      this.#bindRefs.clear();
    }
    if (status !== SQLITE3_ROW && status !== SQLITE3_DONE) {
      unwrap(status, this.db.unsafeHandle);
    }
    sqlite3_reset(handle);
    return sqlite3_changes(this.db.unsafeHandle);
  }

  #valuesNoArgs<T extends Array<unknown>>(): T[] {
    const handle = this.#handle;
    const callback = this.callback;
    this.#begin();
    const columnCount = sqlite3_column_count(handle);
    const result: T[] = [];
    const getRowArray = new Function(
      "getColumn",
      `
      return function(h) {
        return [${
        Array.from({ length: columnCount }).map((_, i) =>
          `getColumn(h, ${i}, ${this.db.int64})`
        )
          .join(", ")
      }];
      };
      `,
    )(getColumn);
    let status;
    if (callback) {
      status = sqlite3_step_cb(handle);
    } else {
      status = sqlite3_step(handle);
    }
    while (status === SQLITE3_ROW) {
      result.push(getRowArray(handle));
      if (callback) {
        status = sqlite3_step_cb(handle);
      } else {
        status = sqlite3_step(handle);
      }
    }
    if (status !== SQLITE3_DONE) {
      unwrap(status, this.db.unsafeHandle);
    }
    sqlite3_reset(handle);
    return result as T[];
  }

  #valuesWithArgs<T extends Array<unknown>>(
    ...params: RestBindParameters
  ): T[] {
    const handle = this.#handle;
    const callback = this.callback;
    this.#begin();
    this.#bindAll(params);
    const columnCount = sqlite3_column_count(handle);
    const result: T[] = [];
    const getRowArray = new Function(
      "getColumn",
      `
      return function(h) {
        return [${
        Array.from({ length: columnCount }).map((_, i) =>
          `getColumn(h, ${i}, ${this.db.int64})`
        )
          .join(", ")
      }];
      };
      `,
    )(getColumn);
    let status;
    if (callback) {
      status = sqlite3_step_cb(handle);
    } else {
      status = sqlite3_step(handle);
    }
    while (status === SQLITE3_ROW) {
      result.push(getRowArray(handle));
      if (callback) {
        status = sqlite3_step_cb(handle);
      } else {
        status = sqlite3_step(handle);
      }
    }
    if (!this.#hasNoArgs && !this.#bound && params.length) {
      this.#bindRefs.clear();
    }
    if (status !== SQLITE3_DONE) {
      unwrap(status, this.db.unsafeHandle);
    }
    sqlite3_reset(handle);
    return result as T[];
  }

  #rowObjectFn: ((h: Deno.PointerValue) => any) | undefined;

  getRowObject(): (h: Deno.PointerValue) => any {
    if (!this.#rowObjectFn || !this.#unsafeConcurrency) {
      const columnNames = this.columnNames();
      const getRowObject = new Function(
        "getColumn",
        `
        return function(h) {
          return {
            ${
          columnNames.map((name, i) =>
            `"${name}": getColumn(h, ${i}, ${this.db.int64})`
          ).join(",\n")
        }
          };
        };
        `,
      )(getColumn);
      this.#rowObjectFn = getRowObject;
    }
    return this.#rowObjectFn!;
  }

  #allNoArgs<T extends Record<string, unknown>>(): T[] {
    const handle = this.#handle;
    const callback = this.callback;
    this.#begin();
    const getRowObject = this.getRowObject();
    const result: T[] = [];
    let status;
    if (callback) {
      status = sqlite3_step_cb(handle);
    } else {
      status = sqlite3_step(handle);
    }
    while (status === SQLITE3_ROW) {
      result.push(getRowObject(handle));
      if (callback) {
        status = sqlite3_step_cb(handle);
      } else {
        status = sqlite3_step(handle);
      }
    }
    if (status !== SQLITE3_DONE) {
      unwrap(status, this.db.unsafeHandle);
    }
    sqlite3_reset(handle);
    return result as T[];
  }

  #allWithArgs<T extends Record<string, unknown>>(
    ...params: RestBindParameters
  ): T[] {
    const handle = this.#handle;
    const callback = this.callback;
    this.#begin();
    this.#bindAll(params);
    const getRowObject = this.getRowObject();
    const result: T[] = [];
    let status;
    if (callback) {
      status = sqlite3_step_cb(handle);
    } else {
      status = sqlite3_step(handle);
    }
    while (status === SQLITE3_ROW) {
      result.push(getRowObject(handle));
      if (callback) {
        status = sqlite3_step_cb(handle);
      } else {
        status = sqlite3_step(handle);
      }
    }
    if (!this.#hasNoArgs && !this.#bound && params.length) {
      this.#bindRefs.clear();
    }
    if (status !== SQLITE3_DONE) {
      unwrap(status, this.db.unsafeHandle);
    }
    sqlite3_reset(handle);
    return result as T[];
  }

  /** Fetch only first row as an array, if any. */
  value<T extends Array<unknown>>(
    ...params: RestBindParameters
  ): T | undefined {
    const handle = this.#handle;
    const int64 = this.db.int64;
    const arr = new Array(sqlite3_column_count(handle));
    sqlite3_reset(handle);
    if (!this.#hasNoArgs && !this.#bound) {
      sqlite3_clear_bindings(handle);
      this.#bindRefs.clear();
      if (params.length) {
        this.#bindAll(params);
      }
    }

    let status;
    if (this.callback) {
      status = sqlite3_step_cb(handle);
    } else {
      status = sqlite3_step(handle);
    }

    if (!this.#hasNoArgs && !this.#bound && params.length) {
      this.#bindRefs.clear();
    }

    if (status === SQLITE3_ROW) {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = getColumn(handle, i, int64);
      }
      sqlite3_reset(this.#handle);
      return arr as T;
    } else if (status === SQLITE3_DONE) {
      return;
    } else {
      unwrap(status, this.db.unsafeHandle);
    }
  }

  #valueNoArgs<T extends Array<unknown>>(): T | undefined {
    const handle = this.#handle;
    const int64 = this.db.int64;
    const cc = sqlite3_column_count(handle);
    const arr = new Array(cc);
    sqlite3_reset(handle);
    let status;
    if (this.callback) {
      status = sqlite3_step_cb(handle);
    } else {
      status = sqlite3_step(handle);
    }
    if (status === SQLITE3_ROW) {
      for (let i = 0; i < cc; i++) {
        arr[i] = getColumn(handle, i, int64);
      }
      sqlite3_reset(this.#handle);
      return arr as T;
    } else if (status === SQLITE3_DONE) {
      return;
    } else {
      unwrap(status, this.db.unsafeHandle);
    }
  }

  #columnNames: string[] | undefined;
  #rowObject: Record<string, unknown> = {};

  columnNames(): string[] {
    if (!this.#columnNames || !this.#unsafeConcurrency) {
      const columnCount = sqlite3_column_count(this.#handle);
      const columnNames = new Array(columnCount);
      for (let i = 0; i < columnCount; i++) {
        columnNames[i] = readCstr(sqlite3_column_name(this.#handle, i)!);
      }
      this.#columnNames = columnNames;
      this.#rowObject = {};
      for (const name of columnNames) {
        this.#rowObject![name] = undefined;
      }
    }
    return this.#columnNames!;
  }

  /** Fetch only first row as an object, if any. */
  get<T extends Record<string, unknown>>(
    ...params: RestBindParameters
  ): T | undefined {
    const handle = this.#handle;
    const int64 = this.db.int64;

    const columnNames = this.columnNames();

    const row: Record<string, unknown> = {};
    sqlite3_reset(handle);
    if (!this.#hasNoArgs && !this.#bound) {
      sqlite3_clear_bindings(handle);
      this.#bindRefs.clear();
      if (params.length) {
        this.#bindAll(params);
      }
    }

    let status;
    if (this.callback) {
      status = sqlite3_step_cb(handle);
    } else {
      status = sqlite3_step(handle);
    }

    if (!this.#hasNoArgs && !this.#bound && params.length) {
      this.#bindRefs.clear();
    }

    if (status === SQLITE3_ROW) {
      for (let i = 0; i < columnNames.length; i++) {
        row[columnNames[i]] = getColumn(handle, i, int64);
      }
      sqlite3_reset(this.#handle);
      return row as T;
    } else if (status === SQLITE3_DONE) {
      return;
    } else {
      unwrap(status, this.db.unsafeHandle);
    }
  }

  #getNoArgs<T extends Record<string, unknown>>(): T | undefined {
    const handle = this.#handle;
    const int64 = this.db.int64;
    const columnNames = this.columnNames();
    const row: Record<string, unknown> = this.#rowObject;
    sqlite3_reset(handle);
    let status;
    if (this.callback) {
      status = sqlite3_step_cb(handle);
    } else {
      status = sqlite3_step(handle);
    }
    if (status === SQLITE3_ROW) {
      for (let i = 0; i < columnNames?.length; i++) {
        row[columnNames[i]] = getColumn(handle, i, int64);
      }
      sqlite3_reset(handle);
      return row as T;
    } else if (status === SQLITE3_DONE) {
      return;
    } else {
      unwrap(status, this.db.unsafeHandle);
    }
  }

  /** Free up the statement object. */
  finalize(): void {
    if (!STATEMENTS_TO_DB.has(this.#handle)) return;
    this.#bindRefs.clear();
    statementFinalizer.unregister(this.#finalizerToken);
    STATEMENTS_TO_DB.delete(this.#handle);
    unwrap(sqlite3_finalize(this.#handle));
  }

  /** Coerces the statement to a string, which in this case is expanded SQL. */
  toString(): string {
    return readCstr(sqlite3_expanded_sql(this.#handle)!);
  }

  /** Iterate over resultant rows from query. */
  *[Symbol.iterator](): IterableIterator<any> {
    this.#begin();
    const getRowObject = this.getRowObject();
    let status;
    if (this.callback) {
      status = sqlite3_step_cb(this.#handle);
    } else {
      status = sqlite3_step(this.#handle);
    }
    while (status === SQLITE3_ROW) {
      yield getRowObject(this.#handle);
      if (this.callback) {
        status = sqlite3_step_cb(this.#handle);
      } else {
        status = sqlite3_step(this.#handle);
      }
    }
    if (status !== SQLITE3_DONE) {
      unwrap(status, this.db.unsafeHandle);
    }
    sqlite3_reset(this.#handle);
  }
}
