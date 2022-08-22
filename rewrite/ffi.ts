const symbols = {
  sqlite3_open_v2: {
    parameters: [
      "pointer", // const char *filename
      "pointer", // sqlite3 **ppDb
      "i32", // int flags
      "u64", // const char *zVfs
    ],
    result: "i32",
  },

  sqlite3_close_v2: {
    parameters: [
      "u64", // sqlite3 *db
    ],
    result: "i32",
  },

  sqlite3_changes: {
    parameters: [
      "u64", // sqlite3 *db
    ],
    result: "i32",
  },

  sqlite3_total_changes: {
    parameters: [
      "u64", // sqlite3 *db
    ],
    result: "i32",
  },

  sqlite3_last_insert_rowid: {
    parameters: [
      "u64", // sqlite3 *db
    ],
    result: "i32",
  },

  sqlite3_get_autocommit: {
    parameters: [
      "u64", // sqlite3 *db
    ],
    result: "i32",
  },

  sqlite3_prepare_v2: {
    parameters: [
      "u64", // sqlite3 *db
      "pointer", // const char *zSql
      "i32", // int nByte
      "pointer", // sqlite3_stmt **ppStmt
      "u64", // const char **pzTail
    ],
    result: "i32",
  },

  sqlite3_reset: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
    ],
    result: "i32",
  },

  sqlite3_clear_bindings: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
    ],
    result: "i32",
  },

  sqlite3_step: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
    ],
    result: "i32",
  },

  sqlite3_column_count: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
    ],
    result: "i32",
  },

  sqlite3_column_type: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "i32",
  },

  sqlite3_column_text: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "u64",
  },

  sqlite3_finalize: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
    ],
    result: "i32",
  },

  sqlite3_exec: {
    parameters: [
      "u64", // sqlite3 *db
      "pointer", // const char *sql
      "u64", // sqlite3_callback callback
      "u64", // void *arg
      "pointer", // char **errmsg
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
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "i32",
  },

  sqlite3_column_double: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "f64",
  },

  sqlite3_column_blob: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "u64",
  },

  sqlite3_column_bytes: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "i32",
  },

  sqlite3_serialize: {
    parameters: [
      "u64", // sqlite3 *db
      "pointer", // const char *sql
      "pointer", // char **errmsg
      "u32",
    ],
    result: "u64",
  },

  sqlite3_column_name: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "u64",
  },

  sqlite3_column_decltype: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "u64",
  },

  sqlite3_bind_parameter_index: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "pointer", // const char *zName
    ],
    result: "i32",
  },

  sqlite3_bind_text: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
      "pointer", // const char *zData
      "i32", // int nData
      "u64", // void (*xDel)(void*)
    ],
    result: "i32",
  },

  sqlite3_bind_blob: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
      "pointer", // const void *zData
      "i32", // int nData
      "u64", // void (*xDel)(void*)
    ],
    result: "i32",
  },

  sqlite3_bind_double: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
      "f64", // double rValue
    ],
    result: "i32",
  },

  sqlite3_bind_int: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
      "i32", // int iValue
    ],
    result: "i32",
  },

  sqlite3_bind_int64: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
      "i64", // i64 iValue
    ],
    result: "i32",
  },

  sqlite3_bind_null: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    result: "i32",
  },

  sqlite3_expanded_sql: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
    ],
    result: "u64",
  },

  sqlite3_bind_parameter_count: {
    parameters: [
      "u64", // sqlite3_stmt *pStmt
    ],
    result: "i32",
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
