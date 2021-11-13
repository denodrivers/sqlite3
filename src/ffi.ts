import { read_cstr } from "./rust_util.ts";
import {
  SQLITE3_DONE,
  SQLITE3_OK,
  SQLITE3_OPEN_CREATE,
  SQLITE3_OPEN_READWRITE,
  SQLITE3_ROW,
} from "./constants.ts";
import {
  cstr,
  getPlatformFileName,
  LITTLE_ENDIAN,
  NULL_F64,
  u64ToF64,
} from "./util.ts";

const lib = Deno.dlopen(
  Deno.env.get("DENO_SQLITE_PATH") ??
    new URL(`../${getPlatformFileName("sqlite3")}`, import.meta.url),
  {
    sqlite3_open_v2: {
      parameters: [
        "buffer", /* const char *path */
        "buffer", /* sqlite3 **db */
        "i32", /* int flags */
        "u64", /* const char *zVfs */
      ],
      result: "i32",
    },

    sqlite3_close_v2: {
      parameters: ["f64" /* sqlite3 *db */],
      result: "i32",
    },

    sqlite3_errmsg: {
      parameters: ["f64" /* sqlite3 *db */],
      result: "u64",
    },

    sqlite3_prepare_v3: {
      parameters: [
        "f64", /* sqlite3 *db */
        "buffer", /* const char *sql */
        "i32", /* int nByte */
        "u32", /* prepFlags */
        "buffer", /* sqlite3_stmt **ppStmt */
        "buffer", /* const char **pzTail */
      ],
      result: "i32",
    },

    sqlite3_libversion: {
      parameters: [],
      result: "u64",
    },

    sqlite3_step: {
      parameters: ["f64" /* sqlite3_stmt *pStmt */],
      result: "i32",
    },

    sqlite3_reset: {
      parameters: ["f64" /* sqlite3_stmt *pStmt */],
      result: "i32",
    },

    sqlite3_finalize: {
      parameters: ["f64" /* sqlite3_stmt *pStmt */],
      result: "i32",
    },

    sqlite3_bind_blob: {
      parameters: [
        "f64", /* sqlite3_stmt *pStmt */
        "i32", /* int i */
        "buffer", /* const void *zData */
        "i32", /* int nData */
        "f64", /* void (*xDel)(void*) */
      ],
      result: "i32",
    },

    sqlite3_bind_blob64: {
      parameters: [
        "f64", /* sqlite3_stmt *pStmt */
        "i32", /* int i */
        "buffer", /* const void *zData */
        "i64", /* sqlite3_uint64 nData */
        "f64", /* void (*xDel)(void*) */
      ],
      result: "i32",
    },

    sqlite3_bind_double: {
      parameters: [
        "f64", /* sqlite3_stmt *pStmt */
        "i32", /* int i */
        "f64", /* double rValue */
      ],
      result: "i32",
    },

    sqlite3_bind_int: {
      parameters: [
        "f64", /* sqlite3_stmt *pStmt */
        "i32", /* int i */
        "i32", /* int iValue */
      ],
      result: "i32",
    },

    sqlite3_bind_int64: {
      parameters: [
        "f64", /* sqlite3_stmt *pStmt */
        "i32", /* int i */
        "i64", /* sqlite3_int64 iValue */
      ],
      result: "i32",
    },

    sqlite3_bind_null: {
      parameters: ["f64", /* sqlite3_stmt *pStmt */ "i32" /* int i */],
      result: "i32",
    },

    sqlite3_bind_text: {
      parameters: [
        "f64", /* sqlite3_stmt *pStmt */
        "i32", /* int i */
        "buffer", /* const char *zData */
        "i32", /* int nData */
        "f64", /* void (*xDel)(void*) */
      ],
      result: "i32",
    },

    sqlite3_bind_value: {
      parameters: [
        "f64", /* sqlite3_stmt *pStmt */
        "i32", /* int i */
        "f64", /* sqlite3_value *pValue */
      ],
      result: "i32",
    },

    sqlite3_bind_zeroblob: {
      parameters: [
        "f64", /* sqlite3_stmt *pStmt */
        "i32", /* int i */
        "i32", /* int n */
      ],
      result: "i32",
    },

    sqlite3_bind_zeroblob64: {
      parameters: [
        "f64", /* sqlite3_stmt *pStmt */
        "i32", /* int i */
        "i64", /* sqlite3_uint64 n */
      ],
      result: "i32",
    },

    sqlite3_exec: {
      parameters: [
        "f64", /* sqlite3 *db */
        "buffer", /* const char *sql */
        "f64", /* sqlite3_callback callback */
        "f64", /* void *pArg */
        "buffer", /* char **errmsg */
      ],
      result: "i32",
    },

    sqlite3_column_blob: {
      parameters: [
        "f64", /* sqlite3_stmt *pStmt */
        "i32", /* int iCol */
      ],
      result: "u64",
    },

    sqlite3_column_double: {
      parameters: ["f64", /* sqlite3_stmt *pStmt */ "i32" /* int iCol */],
      result: "f64",
    },

    sqlite3_column_int: {
      parameters: ["f64", /* sqlite3_stmt *pStmt */ "i32" /* int iCol */],
      result: "i32",
    },

    sqlite3_column_int64: {
      parameters: ["f64", /* sqlite3_stmt *pStmt */ "i32" /* int iCol */],
      result: "i64",
    },

    sqlite3_column_text: {
      parameters: [
        "f64", /* sqlite3_stmt *pStmt */
        "i32", /* int iCol */
      ],
      result: "u64",
    },

    sqlite3_column_text16: {
      parameters: [
        "f64", /* sqlite3_stmt *pStmt */
        "i32", /* int iCol */
      ],
      result: "u64",
    },

    sqlite3_column_type: {
      parameters: ["f64", /* sqlite3_stmt *pStmt */ "i32" /* int iCol */],
      result: "i32",
    },

    sqlite3_column_value: {
      parameters: ["f64", /* sqlite3_stmt *pStmt */ "i32" /* int iCol */],
      result: "u64",
    },

    sqlite3_column_bytes: {
      parameters: ["f64", /* sqlite3_stmt *pStmt */ "i32" /* int iCol */],
      result: "i32",
    },

    sqlite3_column_bytes16: {
      parameters: ["f64", /* sqlite3_stmt *pStmt */ "i32" /* int iCol */],
      result: "i32",
    },

    sqlite3_column_count: {
      parameters: ["f64" /* sqlite3_stmt *pStmt */],
      result: "i32",
    },

    sqlite3_free: {
      parameters: ["f64"],
      result: "void",
    },
  },
);

export type sqlite3 = number;
export type sqlite3_stmt = number;

export function sqlite3_libversion() {
  const ptr = BigInt(lib.symbols.sqlite3_libversion() as number);
  return read_cstr(ptr);
}

export function sqlite3_errmsg(handle: sqlite3) {
  return read_cstr(
    BigInt(lib.symbols.sqlite3_errmsg(handle) as number),
  );
}

export function sqlite3_open_v2(
  path: string,
  flags: number = SQLITE3_OPEN_CREATE | SQLITE3_OPEN_READWRITE,
): sqlite3 {
  const pathPtr = cstr(path);
  const outDB = new Uint8Array(8);
  const outDV = new DataView(outDB.buffer);
  const vfsPtr = 0;

  const result = lib.symbols.sqlite3_open_v2(
    pathPtr,
    outDB,
    flags,
    vfsPtr,
  );

  const handle = outDV.getFloat64(0, LITTLE_ENDIAN);

  if (result !== SQLITE3_OK) {
    const msg = sqlite3_errmsg(handle);
    sqlite3_close_v2(handle);
    throw new Error(`(${result}) ${msg}`);
  }

  return handle;
}

export function sqlite3_close_v2(handle: sqlite3) {
  lib.symbols.sqlite3_close_v2(handle);
}

export function sqlite3_prepare_v3(
  handle: sqlite3,
  sql: string,
  flags: number = 0,
): sqlite3_stmt {
  const sqlPtr = cstr(sql);
  const outStmt = new Uint8Array(8);
  const outStmtDV = new DataView(outStmt.buffer);
  const outTail = new Uint8Array(8);
  // const outTailDV = new DataView(outTail.buffer);

  const result = lib.symbols.sqlite3_prepare_v3(
    handle,
    sqlPtr,
    sql.length,
    flags,
    outStmt,
    outTail,
  ) as number;

  const stmt = outStmtDV.getFloat64(0, LITTLE_ENDIAN);
  // const tail = read_cstr(outTailDV.getBigUint64(0, LITTLE_ENDIAN));

  if (result !== SQLITE3_OK) {
    const msg = sqlite3_errmsg(handle);
    throw new Error(`(${result}) ${msg}`);
  }

  return stmt;
}

export function sqlite3_step(db: sqlite3, stmt: sqlite3_stmt) {
  const result = lib.symbols.sqlite3_step(stmt) as number;

  if (result === SQLITE3_ROW || result === SQLITE3_DONE) {
    return result;
  }

  const msg = sqlite3_errmsg(db);
  throw new Error(`(${result}) ${msg}`);
}

export function sqlite3_finalize(db: sqlite3, stmt: sqlite3_stmt) {
  const result = lib.symbols.sqlite3_finalize(stmt) as number;

  if (result === SQLITE3_OK) {
    return result;
  }

  const msg = sqlite3_errmsg(db);
  throw new Error(`(${result}) ${msg}`);
}

export function sqlite3_bind_text(
  stmt: sqlite3,
  index: number,
  value: Uint8Array,
  length: number = -1,
) {
  const result = lib.symbols.sqlite3_bind_text(
    stmt,
    index,
    value,
    length,
    NULL_F64,
  ) as number;

  if (result !== SQLITE3_OK) {
    const msg = sqlite3_errmsg(stmt);
    throw new Error(`(${result}) ${msg}`);
  }
}

export function sqlite3_column_blob(stmt: sqlite3_stmt, col: number) {
  const ptr = lib.symbols.sqlite3_column_blob(stmt, col) as number;
  return ptr;
}

export function sqlite3_column_bytes(stmt: sqlite3_stmt, col: number) {
  const bytes = lib.symbols.sqlite3_column_bytes(stmt, col) as number;
  return bytes;
}

export function sqlite3_column_bytes16(stmt: sqlite3_stmt, col: number) {
  const bytes = lib.symbols.sqlite3_column_bytes16(
    stmt,
    col,
  ) as number;
  return bytes;
}

export function sqlite3_column_count(stmt: sqlite3_stmt) {
  const count = lib.symbols.sqlite3_column_count(stmt) as number;
  return count;
}

export function sqlite3_column_type(stmt: sqlite3_stmt, col: number) {
  const type = lib.symbols.sqlite3_column_type(stmt, col) as number;
  return type;
}

export function sqlite3_column_text(stmt: sqlite3_stmt, col: number) {
  const ptr = lib.symbols.sqlite3_column_text(stmt, col) as number;
  return ptr;
}

export function sqlite3_free(ptr: number) {
  lib.symbols.sqlite3_free(ptr);
}

export function sqlite3_exec(
  db: sqlite3,
  sql: string,
  pArg = NULL_F64,
) {
  const sqlPtr = cstr(sql);
  const outPtr = new Uint8Array(8);
  const outDV = new DataView(outPtr.buffer);

  const result = lib.symbols.sqlite3_exec(
    db,
    sqlPtr,
    NULL_F64,
    pArg,
    outPtr,
  );

  const ptr = outDV.getBigUint64(0, LITTLE_ENDIAN);

  if (result !== SQLITE3_OK) {
    const msg = read_cstr(ptr);
    sqlite3_free(u64ToF64(ptr));
    throw new Error(`(${result}) ${msg}`);
  }
}

export function sqlite3_reset(db: sqlite3, stmt: sqlite3_stmt) {
  const result = lib.symbols.sqlite3_reset(stmt) as number;

  if (result === SQLITE3_OK) {
    return result;
  }

  const msg = sqlite3_errmsg(db);
  throw new Error(`(${result}) ${msg}`);
}
