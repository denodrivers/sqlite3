import {
  SQLITE3_DONE,
  SQLITE3_MISUSE,
  SQLITE3_OK,
  SQLITE3_OPEN_CREATE,
  SQLITE3_OPEN_READWRITE,
  SQLITE3_ROW,
} from "./constants.ts";
import { toCString } from "./util.ts";

const symbols = {
  sqlite3_open_v2: {
    parameters: [
      "pointer", /* const char *path */
      "pointer", /* sqlite3 **db */
      "i32", /* int flags */
      "pointer", /* const char *zVfs */
    ],
    result: "i32",
  },

  sqlite3_close_v2: {
    parameters: ["pointer" /* sqlite3 *db */],
    result: "i32",
  },

  sqlite3_errmsg: {
    parameters: ["pointer" /* sqlite3 *db */],
    result: "pointer", /* const char * */
  },

  sqlite3_changes: {
    parameters: ["pointer" /* sqlite3 *db */],
    result: "i32",
  },

  sqlite3_total_changes: {
    parameters: ["pointer" /* sqlite3 *db */],
    result: "i32",
  },

  sqlite3_prepare_v2: {
    parameters: [
      "pointer", /* sqlite3 *db */
      "pointer", /* const char *sql */
      "i32", /* int nByte */
      "pointer", /* sqlite3_stmt **ppStmt */
      "pointer", /* const char **pzTail */
    ],
    result: "i32",
  },

  sqlite3_libversion: {
    parameters: [],
    result: "pointer",
  },

  sqlite3_step: {
    parameters: ["pointer" /* sqlite3_stmt *pStmt */],
    result: "i32",
  },

  sqlite3_reset: {
    parameters: ["pointer" /* sqlite3_stmt *pStmt */],
    result: "i32",
  },

  sqlite3_finalize: {
    parameters: ["pointer" /* sqlite3_stmt *pStmt */],
    result: "i32",
  },

  sqlite3_bind_parameter_count: {
    parameters: ["pointer" /* sqlite3_stmt *pStmt */],
    result: "i32",
  },

  sqlite3_bind_parameter_index: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "pointer", /* const char *zName */
    ],
    result: "i32",
  },

  sqlite3_bind_parameter_name: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int i */
    ],
    result: "pointer",
  },

  sqlite3_bind_blob: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int i */
      "pointer", /* const void *zData */
      "i32", /* int nData */
      "pointer", /* void (*xDel)(void*) */
    ],
    result: "i32",
  },

  sqlite3_bind_blob64: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int i */
      "pointer", /* const void *zData */
      "u64", /* sqlite3_uint64 nData */
      "pointer", /* void (*xDel)(void*) */
    ],
    result: "i32",
  },

  sqlite3_bind_double: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int i */
      "f64", /* double rValue */
    ],
    result: "i32",
  },

  sqlite3_bind_int: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int i */
      "i32", /* int iValue */
    ],
    result: "i32",
  },

  sqlite3_bind_int64: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int i */
      "pointer", /* sqlite3_int64 iValue */
    ],
    result: "i32",
  },

  sqlite3_bind_null: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int i */
    ],
    result: "i32",
  },

  sqlite3_bind_text: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int i */
      "pointer", /* const char *zData */
      "i32", /* int nData */
      "pointer", /* void (*xDel)(void*) */
    ],
    result: "i32",
  },

  sqlite3_bind_value: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int i */
      "pointer", /* sqlite3_value *pValue */
    ],
    result: "i32",
  },

  sqlite3_bind_zeroblob: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int i */
      "i32", /* int n */
    ],
    result: "i32",
  },

  sqlite3_bind_zeroblob64: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int i */
      "i64", /* sqlite3_uint64 n */
    ],
    result: "i32",
  },

  sqlite3_exec: {
    parameters: [
      "pointer", /* sqlite3 *db */
      "pointer", /* const char *sql */
      "pointer", /* sqlite3_callback callback */
      "pointer", /* void *pArg */
      "pointer", /* char **errmsg */
    ],
    result: "i32",
  },

  sqlite3_column_blob: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int iCol */
    ],
    result: "pointer",
  },

  sqlite3_column_double: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int iCol */
    ],
    result: "f64",
  },

  sqlite3_column_int: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int iCol */
    ],
    result: "i32",
  },

  sqlite3_column_int64: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int iCol */
    ],
    result: "pointer",
  },

  sqlite3_column_text: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int iCol */
    ],
    result: "pointer",
  },

  sqlite3_column_text16: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int iCol */
    ],
    result: "pointer",
  },

  sqlite3_column_type: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int iCol */
    ],
    result: "i32",
  },

  sqlite3_column_value: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int iCol */
    ],
    result: "pointer",
  },

  sqlite3_column_bytes: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int iCol */
    ],
    result: "i32",
  },

  sqlite3_column_bytes16: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int iCol */
    ],
    result: "i32",
  },

  sqlite3_column_count: {
    parameters: ["pointer" /* sqlite3_stmt *pStmt */],
    result: "i32",
  },

  sqlite3_column_name: {
    parameters: [
      "pointer", /* sqlite3_stmt *pStmt */
      "i32", /* int iCol */
    ],
    result: "pointer",
  },

  sqlite3_free: {
    parameters: ["pointer" /** void* ptr */],
    result: "void",
  },

  sqlite3_errstr: {
    parameters: ["i32" /** int errcode */],
    result: "pointer",
  },

  sqlite3_blob_open: {
    parameters: [
      "pointer", /* sqlite3 *db */
      "pointer", /* const char *zDb */
      "pointer", /* const char *zTable */
      "pointer", /* const char *zColumn */
      "i64", /* sqlite3_int64 iRow */
      "i32", /* int flags */
      "pointer", /* sqlite3_blob **ppBlob */
    ],
    result: "i32",
  },

  sqlite3_blob_read: {
    parameters: [
      "pointer", /* sqlite3_blob *blob */
      "pointer", /* void *Z */
      "i32", /* int N */
      "i32", /* int iOffset */
    ],
    result: "i32",
  },

  sqlite3_blob_write: {
    parameters: [
      "pointer", /* sqlite3_blob *blob */
      "pointer", /* const void *z */
      "i32", /* int n */
      "i32", /* int iOffset */
    ],
    result: "i32",
  },

  sqlite3_blob_read_async: {
    name: "sqlite3_blob_read",
    parameters: [
      "pointer", /* sqlite3_blob *blob */
      "pointer", /* void *Z */
      "i32", /* int N */
      "i32", /* int iOffset */
    ],
    nonblocking: true,
    result: "i32",
  },

  sqlite3_blob_write_async: {
    name: "sqlite3_blob_write",
    parameters: [
      "pointer", /* sqlite3_blob *blob */
      "pointer", /* const void *z */
      "i32", /* int n */
      "i32", /* int iOffset */
    ],
    nonblocking: true,
    result: "i32",
  },

  sqlite3_blob_bytes: {
    parameters: ["pointer" /* sqlite3_blob *blob */],
    result: "i32",
  },

  sqlite3_blob_close: {
    parameters: ["pointer" /* sqlite3_blob *blob */],
    result: "i32",
  },

  sqlite3_sql: {
    parameters: ["pointer" /* sqlite3_stmt *pStmt */],
    result: "pointer",
  },

  sqlite3_expanded_sql: {
    parameters: ["pointer" /* sqlite3_stmt *pStmt */],
    result: "pointer",
  },

  sqlite3_stmt_readonly: {
    parameters: ["pointer" /* sqlite3_stmt *pStmt */],
    result: "i32",
  },

  sqlite3_complete: {
    parameters: ["pointer" /* const char *sql */],
    result: "i32",
  },

  sqlite3_last_insert_rowid: {
    parameters: ["pointer" /* sqlite3 *db */],
    result: "i64",
  },

  sqlite3_get_autocommit: {
    parameters: ["pointer" /* sqlite3 *db */],
    result: "i32",
  },

  sqlite3_clear_bindings: {
    parameters: ["pointer" /* sqlite3_stmt *pStmt */],
    result: "i32",
  },

  sqlite3_sourceid: {
    parameters: [],
    result: "pointer",
  },
} as const;

let lib: Deno.DynamicLibrary<typeof symbols>;

try {
  const filename = Deno.env.get("DENO_SQLITE_PATH") || {
    windows: "sqlite3",
    darwin: "libsqlite3.dylib",
    linux: "libsqlite3.so",
  }[Deno.build.os];
  lib = Deno.dlopen(filename, symbols);
} catch (e) {
  if (e instanceof Deno.errors.PermissionDenied) {
    throw e;
  }

  const error = new Error(
    "Native SQLite3 library not found, try installing SQLite3. If you have an existing installation, either add it to path or set the `DENO_SQLITE_PATH` environment variable.",
  );
  error.cause = e;
  throw error;
}

export type sqlite3 = Deno.UnsafePointer;
export type sqlite3_stmt = Deno.UnsafePointer;
export type sqlite3_value = Deno.UnsafePointer;
export type sqlite3_blob = Deno.UnsafePointer;

export function sqlite3_libversion(): string {
  const ptr = lib.symbols.sqlite3_libversion() as Deno.UnsafePointer;
  return new Deno.UnsafePointerView(ptr).getCString();
}

export function sqlite3_errmsg(handle: sqlite3): string {
  const ptr = lib.symbols.sqlite3_errmsg(handle) as Deno.UnsafePointer;
  return new Deno.UnsafePointerView(ptr).getCString();
}

export function sqlite3_errstr(result: number): string {
  const ptr = lib.symbols.sqlite3_errstr(result) as Deno.UnsafePointer;
  return new Deno.UnsafePointerView(ptr).getCString();
}

export function unwrap_error(
  db: sqlite3,
  result: number,
  valid?: number[],
): void {
  valid = valid ?? [SQLITE3_OK];
  if (!valid.includes(result)) {
    let msg;
    try {
      if (result === SQLITE3_MISUSE) {
        msg = sqlite3_errstr(result);
      } else msg = sqlite3_errmsg(db);
    } catch (e) {
      msg = new Error(`Failed to get error message.`);
      msg.cause = e;
    }
    throw new Error(`(${result}) ${sqlite3_errstr(result)}: ${msg}`);
  }
}

export function sqlite3_open_v2(path: string, flags?: number): sqlite3 {
  flags = flags ?? SQLITE3_OPEN_CREATE | SQLITE3_OPEN_READWRITE;
  const pathPtr = toCString(path);
  const outDB = new BigUint64Array(1);

  const result = lib.symbols.sqlite3_open_v2(
    pathPtr,
    outDB,
    flags,
    null,
  ) as number;

  const handle = new Deno.UnsafePointer(outDB[0]);
  unwrap_error(handle, result);

  return handle;
}

export function sqlite3_close_v2(handle: sqlite3): void {
  lib.symbols.sqlite3_close_v2(handle);
}

export function sqlite3_prepare_v2(
  db: sqlite3,
  sql: string,
): sqlite3_stmt {
  const sqlPtr = toCString(sql);
  const outStmt = new BigUint64Array(1);
  const outTail = new Uint8Array(8);

  const result = lib.symbols.sqlite3_prepare_v2(
    db,
    sqlPtr,
    sql.length,
    outStmt,
    outTail,
  ) as number;

  const stmt = new Deno.UnsafePointer(outStmt[0]);
  if (stmt.value === 0n && result === SQLITE3_OK) {
    throw new Error(`failed to prepare`);
  }
  unwrap_error(db, result);

  return stmt;
}

export function sqlite3_step(db: sqlite3, stmt: sqlite3_stmt): number {
  const result = lib.symbols.sqlite3_step(stmt);
  unwrap_error(db, result, [SQLITE3_ROW, SQLITE3_DONE]);
  return result;
}

export function sqlite3_finalize(db: sqlite3, stmt: sqlite3_stmt): void {
  const result = lib.symbols.sqlite3_finalize(stmt) as number;
  unwrap_error(db, result);
}

export function sqlite3_bind_text(
  db: sqlite3,
  stmt: sqlite3_stmt,
  index: number,
  value: Uint8Array,
): void {
  const result = lib.symbols.sqlite3_bind_text(
    stmt,
    index,
    value,
    value.byteLength,
    null,
  );
  unwrap_error(db, result);
}

export function sqlite3_bind_null(
  db: sqlite3,
  stmt: sqlite3_stmt,
  index: number,
): void {
  const result = lib.symbols.sqlite3_bind_null(stmt, index) as number;
  unwrap_error(db, result);
}

export function sqlite3_bind_int(
  db: sqlite3,
  stmt: sqlite3_stmt,
  index: number,
  value: number,
): void {
  const result = lib.symbols.sqlite3_bind_int(stmt, index, value) as number;
  unwrap_error(db, result);
}

export function sqlite3_bind_int64(
  db: sqlite3,
  stmt: sqlite3_stmt,
  index: number,
  value: bigint,
): void {
  const uint = new BigUint64Array(1);
  const int = new BigInt64Array(uint.buffer);
  int[0] = value;

  const result = lib.symbols.sqlite3_bind_int64(
    stmt,
    index,
    // workaround for passing bigint
    new Deno.UnsafePointer(uint[0]),
  ) as number;
  unwrap_error(db, result);
}

export function sqlite3_bind_double(
  db: sqlite3,
  stmt: sqlite3_stmt,
  index: number,
  value: number,
): void {
  const result = lib.symbols.sqlite3_bind_double(
    stmt,
    index,
    value,
  ) as number;
  unwrap_error(db, result);
}

export function sqlite3_bind_blob(
  db: sqlite3,
  stmt: sqlite3_stmt,
  index: number,
  value: Uint8Array,
): void {
  const result = lib.symbols.sqlite3_bind_blob(
    stmt,
    index,
    value,
    value.length,
    null,
  ) as number;
  unwrap_error(db, result);
}

export function sqlite3_bind_value(
  db: sqlite3,
  stmt: sqlite3_stmt,
  index: number,
  value: sqlite3_value,
): void {
  const result = lib.symbols.sqlite3_bind_value(stmt, index, value) as number;
  unwrap_error(db, result);
}

export function sqlite3_column_value(
  stmt: sqlite3_stmt,
  col: number,
): sqlite3_value {
  const ptr = lib.symbols.sqlite3_column_value(stmt, col) as Deno.UnsafePointer;
  return ptr;
}

export function sqlite3_column_blob(
  stmt: sqlite3_stmt,
  col: number,
): Deno.UnsafePointer {
  return lib.symbols.sqlite3_column_blob(stmt, col);
}

export function sqlite3_column_bytes(stmt: sqlite3_stmt, col: number): number {
  return lib.symbols.sqlite3_column_bytes(stmt, col);
}

export function sqlite3_column_bytes16(
  stmt: sqlite3_stmt,
  col: number,
): number {
  return lib.symbols.sqlite3_column_bytes16(
    stmt,
    col,
  );
}

export function sqlite3_column_count(stmt: sqlite3_stmt): number {
  return lib.symbols.sqlite3_column_count(stmt);
}

export function sqlite3_column_type(stmt: sqlite3_stmt, col: number): number {
  return lib.symbols.sqlite3_column_type(stmt, col);
}

export function sqlite3_column_text(
  stmt: sqlite3_stmt,
  col: number,
): string | null {
  const ptr = lib.symbols.sqlite3_column_text(stmt, col) as Deno.UnsafePointer;
  if (ptr.value === 0n) return null;
  return new Deno.UnsafePointerView(ptr).getCString();
}

export function sqlite3_column_text16(
  stmt: sqlite3_stmt,
  col: number,
): string | null {
  const ptr = lib.symbols.sqlite3_column_text16(
    stmt,
    col,
  ) as Deno.UnsafePointer;
  if (ptr.value === 0n) return null;
  return new Deno.UnsafePointerView(ptr).getCString();
}

export function sqlite3_column_int(stmt: sqlite3_stmt, col: number): number {
  return lib.symbols.sqlite3_column_int(stmt, col) as number;
}

export function sqlite3_column_int64(stmt: sqlite3_stmt, col: number): bigint {
  // workaround for returning bigint
  const int = new BigInt64Array(1);
  const uint = new BigUint64Array(int.buffer);
  uint[0] =
    (lib.symbols.sqlite3_column_int64(stmt, col) as Deno.UnsafePointer).value;
  return int[0];
}

export function sqlite3_column_double(stmt: sqlite3_stmt, col: number): number {
  return lib.symbols.sqlite3_column_double(stmt, col) as number;
}

export function sqlite3_free(ptr: Deno.UnsafePointer): void {
  lib.symbols.sqlite3_free(ptr);
}

export function sqlite3_exec(
  db: sqlite3,
  sql: string,
): void {
  const sqlPtr = toCString(sql);
  const outPtr = new BigUint64Array(8);

  const result = lib.symbols.sqlite3_exec(
    db,
    sqlPtr,
    null,
    null,
    outPtr,
  );

  const ptr = new Deno.UnsafePointer(outPtr[0]);

  if (result !== SQLITE3_OK) {
    const msg = new Deno.UnsafePointerView(ptr).getCString();
    sqlite3_free(ptr);
    throw new Error(`(${result}) ${msg}`);
  }
}

export function sqlite3_reset(db: sqlite3, stmt: sqlite3_stmt): void {
  const result = lib.symbols.sqlite3_reset(stmt) as number;
  unwrap_error(db, result);
}

export function sqlite3_bind_parameter_count(stmt: sqlite3_stmt): number {
  return lib.symbols.sqlite3_bind_parameter_count(stmt) as number;
}

export function sqlite3_bind_parameter_index(
  stmt: sqlite3_stmt,
  name: string,
): number {
  const namePtr = toCString(name);
  const index = lib.symbols.sqlite3_bind_parameter_index(
    stmt,
    namePtr,
  ) as number;
  return index;
}

export function sqlite3_bind_parameter_name(
  stmt: sqlite3_stmt,
  index: number,
): string {
  const name = lib.symbols.sqlite3_bind_parameter_name(
    stmt,
    index,
  ) as Deno.UnsafePointer;
  return new Deno.UnsafePointerView(name).getCString();
}

export function sqlite3_column_name(stmt: sqlite3_stmt, col: number): string {
  const name = lib.symbols.sqlite3_column_name(stmt, col) as Deno.UnsafePointer;
  return new Deno.UnsafePointerView(name).getCString();
}

export function sqlite3_changes(db: sqlite3): number {
  return lib.symbols.sqlite3_changes(db);
}

export function sqlite3_total_changes(db: sqlite3): number {
  return lib.symbols.sqlite3_total_changes(db);
}

export function sqlite3_blob_open(
  db: sqlite3,
  dbName: string,
  tableName: string,
  columnName: string,
  rowId: number,
  flags: number,
): sqlite3_blob {
  const dbNamePtr = toCString(dbName);
  const tableNamePtr = toCString(tableName);
  const columnNamePtr = toCString(columnName);
  const outBlob = new BigUint64Array(1);
  const result = lib.symbols.sqlite3_blob_open(
    db,
    dbNamePtr,
    tableNamePtr,
    columnNamePtr,
    rowId,
    flags,
    outBlob,
  ) as number;
  unwrap_error(db, result);
  return new Deno.UnsafePointer(outBlob[0]);
}

export function sqlite3_blob_read(
  blob: sqlite3_blob,
  buffer: Uint8Array,
  offset: number,
  n: number,
): void {
  const result = lib.symbols.sqlite3_blob_read(
    blob,
    buffer,
    n,
    offset,
  ) as number;
  unwrap_error(blob, result);
}

export function sqlite3_blob_write(
  blob: sqlite3_blob,
  buffer: Uint8Array,
  offset: number,
  n: number,
): void {
  const result = lib.symbols.sqlite3_blob_write(
    blob,
    buffer,
    n,
    offset,
  ) as number;
  unwrap_error(blob, result);
}

export async function sqlite3_blob_read_async(
  blob: sqlite3_blob,
  buffer: Uint8Array,
  offset: number,
  n: number,
): Promise<void> {
  const result = await lib.symbols.sqlite3_blob_read_async(
    blob,
    buffer,
    n,
    offset,
  );
  unwrap_error(blob, result);
}

export async function sqlite3_blob_write_async(
  blob: sqlite3_blob,
  buffer: Uint8Array,
  offset: number,
  n: number,
): Promise<void> {
  const result = await lib.symbols.sqlite3_blob_write_async(
    blob,
    buffer,
    n,
    offset,
  );
  unwrap_error(blob, result);
}

export function sqlite3_blob_bytes(blob: sqlite3_blob): number {
  return lib.symbols.sqlite3_blob_bytes(blob) as number;
}

export function sqlite3_blob_close(blob: sqlite3_blob): void {
  const result = lib.symbols.sqlite3_blob_close(blob) as number;
  unwrap_error(blob, result);
}

export function sqlite3_sql(stmt: sqlite3_stmt): string | null {
  const ptr = lib.symbols.sqlite3_sql(stmt);
  if (ptr.value === 0n) return null;
  else return new Deno.UnsafePointerView(ptr).getCString();
}

export function sqlite3_expanded_sql(stmt: sqlite3_stmt): string | null {
  const ptr = lib.symbols.sqlite3_expanded_sql(stmt);
  if (ptr.value === 0n) return null;
  const str = new Deno.UnsafePointerView(ptr).getCString();
  sqlite3_free(ptr);
  return str;
}

export function sqlite3_stmt_readonly(stmt: sqlite3_stmt): boolean {
  return Boolean(lib.symbols.sqlite3_stmt_readonly(stmt));
}

export function sqlite3_complete(sql: string): boolean {
  const sqlPtr = toCString(sql);
  return Boolean(lib.symbols.sqlite3_complete(sqlPtr));
}

export function sqlite3_last_insert_rowid(db: sqlite3): number {
  return lib.symbols.sqlite3_last_insert_rowid(db);
}

export function sqlite3_get_autocommit(db: sqlite3): boolean {
  return Boolean(lib.symbols.sqlite3_get_autocommit(db));
}

export function sqlite3_clear_bindings(db: sqlite3, stmt: sqlite3_stmt): void {
  const result = lib.symbols.sqlite3_clear_bindings(stmt) as number;
  unwrap_error(db, result);
}

export function sqlite3_sourceid(): string {
  const ptr = lib.symbols.sqlite3_sourceid();
  return new Deno.UnsafePointerView(ptr).getCString();
}
