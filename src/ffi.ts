const symbols = {
  sqlite3_open_v2: {
    parameters: [
      "buffer", // const char *filename
      "buffer", // sqlite3 **ppDb
      "i32", // int flags
      "pointer", // const char *zVfs
    ],
    result: "i32",
  },

  sqlite3_close_v2: {
    parameters: [
      "pointer", // sqlite3 *db
    ],
    result: "i32",
  },

  sqlite3_changes: {
    parameters: [
      "pointer", // sqlite3 *db
    ],
    result: "i32",
  },

  sqlite3_total_changes: {
    parameters: [
      "pointer", // sqlite3 *db
    ],
    result: "i32",
  },

  sqlite3_last_insert_rowid: {
    parameters: [
      "pointer", // sqlite3 *db
    ],
    result: "i32",
  },

  sqlite3_get_autocommit: {
    parameters: [
      "pointer", // sqlite3 *db
    ],
    result: "i32",
  },

  sqlite3_prepare_v2: {
    parameters: [
      "pointer", // sqlite3 *db
      "buffer", // const char *zSql
      "i32", // int nByte
      "buffer", // sqlite3_stmt **ppStmt
      "pointer", // const char **pzTail
    ],
    result: "i32",
  },

  sqlite3_reset: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
    ],
    result: "i32",
  },

  sqlite3_clear_bindings: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
    ],
    result: "i32",
  },

  sqlite3_step: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
    ],
    result: "i32",
  },

  sqlite3_column_count: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
    ],
    result: "i32",
  },

  sqlite3_column_type: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "pointer", // int iCol
    ],
    result: "i32",
  },

  sqlite3_column_text: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "u64",
  },

  sqlite3_finalize: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
    ],
    result: "i32",
  },

  sqlite3_exec: {
    parameters: [
      "pointer", // sqlite3 *db
      "buffer", // const char *sql
      "pointer", // sqlite3_callback callback
      "pointer", // void *arg
      "buffer", // char **errmsg
    ],
    result: "i32",
  },

  sqlite3_free: {
    parameters: [
      "pointer", // void *p
    ],
    result: "void",
  },

  sqlite3_column_int: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "i32",
  },

  sqlite3_column_double: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "f64",
  },

  sqlite3_column_blob: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "u64",
  },

  sqlite3_column_bytes: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "i32",
  },

  sqlite3_column_name: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "u64",
  },

  sqlite3_column_decltype: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "u64",
  },

  sqlite3_bind_parameter_index: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "buffer", // const char *zName
    ],
    result: "i32",
  },

  sqlite3_bind_text: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
      "buffer", // const char *zData
      "i32", // int nData
      "pointer", // void (*xDel)(void*)
    ],
    result: "i32",
  },

  sqlite3_bind_blob: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
      "buffer", // const void *zData
      "i32", // int nData
      "pointer", // void (*xDel)(void*)
    ],
    result: "i32",
  },

  sqlite3_bind_double: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
      "f64", // double rValue
    ],
    result: "i32",
  },

  sqlite3_bind_int: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
      "i32", // int iValue
    ],
    result: "i32",
  },

  sqlite3_bind_int64: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
      "i64", // i64 iValue
    ],
    result: "i32",
  },

  sqlite3_bind_null: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "i32",
  },

  sqlite3_expanded_sql: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
    ],
    result: "u64",
  },

  sqlite3_bind_parameter_count: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
    ],
    result: "i32",
  },

  sqlite3_complete: {
    parameters: [
      "buffer", // const char *sql
    ],
    result: "i32",
  },

  sqlite3_sourceid: {
    parameters: [],
    result: "pointer",
  },

  sqlite3_libversion: {
    parameters: [],
    result: "pointer",
  },

  sqlite3_blob_open: {
    parameters: [
      "pointer", /* sqlite3 *db */
      "buffer", /* const char *zDb */
      "buffer", /* const char *zTable */
      "buffer", /* const char *zColumn */
      "i64", /* sqlite3_int64 iRow */
      "i32", /* int flags */
      "buffer", /* sqlite3_blob **ppBlob */
    ],
    result: "i32",
  },

  sqlite3_blob_read: {
    parameters: [
      "pointer", /* sqlite3_blob *blob */
      "buffer", /* void *Z */
      "i32", /* int N */
      "i32", /* int iOffset */
    ],
    result: "i32",
  },

  sqlite3_blob_write: {
    parameters: [
      "pointer", /* sqlite3_blob *blob */
      "buffer", /* const void *z */
      "i32", /* int n */
      "i32", /* int iOffset */
    ],
    result: "i32",
  },

  sqlite3_blob_read_async: {
    name: "sqlite3_blob_read",
    parameters: [
      "pointer", /* sqlite3_blob *blob */
      "buffer", /* void *Z */
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
      "buffer", /* const void *z */
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
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
    ],
    result: "pointer",
  },

  sqlite3_stmt_readonly: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
    ],
    result: "i32",
  },

  sqlite3_bind_parameter_name: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "pointer",
  },

  sqlite3_errmsg: {
    parameters: [
      "pointer", // sqlite3 *db
    ],
    result: "pointer",
  },

  sqlite3_errstr: {
    parameters: [
      "i32", // int rc
    ],
    result: "pointer",
  },

  sqlite3_column_int64: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "i64",
  },

  sqlite3_backup_init: {
    parameters: [
      "pointer", // sqlite3 *pDest
      "buffer", // const char *zDestName
      "pointer", // sqlite3 *pSource
      "buffer", // const char *zSourceName
    ],
    result: "pointer",
  },

  sqlite3_backup_step: {
    parameters: [
      "pointer", // sqlite3_backup *p
      "i32", // int nPage
    ],
    result: "i32",
  },

  sqlite3_backup_finish: {
    parameters: [
      "pointer", // sqlite3_backup *p
    ],
    result: "i32",
  },

  sqlite3_backup_remaining: {
    parameters: [
      "pointer", // sqlite3_backup *p
    ],
    result: "i32",
  },

  sqlite3_backup_pagecount: {
    parameters: [
      "pointer", // sqlite3_backup *p
    ],
    result: "i32",
  },

  sqlite3_column_int_fast: {
    parameters: [
      "pointer", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "i32",
  },

  fastconfig: {
    parameters: [
      "buffer", // char* flag
      "buffer", // int64* value
    ],
    result: "void",
  },
} as const;

let lib: Deno.DynamicLibrary<typeof symbols>["symbols"];

try {
  const filename = Deno.env.get("DENO_SQLITE_PATH") || {
    windows: "sqlite3",
    darwin: "libsqlite3.dylib",
    linux: "libsqlite3.so",
  }[Deno.build.os];
  lib = Deno.dlopen(filename, symbols).symbols;
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

export default lib;
