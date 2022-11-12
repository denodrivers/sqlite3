import { dlopen, ptr } from "bun:ffi";

import {
  SQLITE3_OPEN_CREATE,
  SQLITE3_OPEN_MEMORY,
  SQLITE3_OPEN_PRIVATECACHE,
  SQLITE3_OPEN_READWRITE,
} from "../src/constants.ts";

const {
  symbols: {
    sqlite3_open_v2,
    sqlite3_exec,
    sqlite3_prepare_v2,
    sqlite3_reset,
    sqlite3_step,
    sqlite3_column_int,
    sqlite3_errstr,
  },
} = dlopen("build/libsqlite3.dylib", {
  sqlite3_open_v2: {
    args: [
      "ptr", // const char *filename
      "ptr", // sqlite3 **ppDb
      "i32", // int flags
      "u64", // const char *zVfs
    ],
    returns: "i32",
  },

  sqlite3_errstr: {
    args: ["i32" /** int errcode */],
    returns: "cstring",
  },

  sqlite3_prepare_v2: {
    args: [
      "u64", // sqlite3 *db
      "ptr", // const char *zSql
      "i32", // int nByte
      "ptr", // sqlite3_stmt **ppStmt
      "u64", // const char **pzTail
    ],
    returns: "i32",
  },

  sqlite3_exec: {
    args: [
      "u64", // sqlite3 *db
      "ptr", // const char *sql
      "u64", // sqlite3_callback callback
      "u64", // void *arg
      "ptr", // char **errmsg
    ],
    returns: "i32",
  },

  sqlite3_reset: {
    args: [
      "u64", // sqlite3_stmt *pStmt
    ],
    returns: "i32",
  },

  sqlite3_step: {
    args: [
      "u64", // sqlite3_stmt *pStmt
    ],
    returns: "i32",
  },

  sqlite3_column_int: {
    args: [
      "u64", // sqlite3_stmt *pStmt
      "i32", // int iCol
    ],
    returns: "i32",
  },
});

function unwrap(code) {
  if (code !== 0) {
    throw new Error(`SQLite3 error: ${sqlite3_errstr(code)}: ${code}`);
  }
}

const pHandle = new Uint32Array(2);
const encoder = new TextEncoder();

unwrap(
  sqlite3_open_v2(
    ptr(encoder.encode(":memory:\0")),
    ptr(pHandle),
    SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_PRIVATECACHE |
      SQLITE3_OPEN_CREATE | SQLITE3_OPEN_MEMORY,
    0,
  ),
);

const db = pHandle[0] + 2 ** 32 * pHandle[1];

function exec(sql) {
  const _pErr = new Uint32Array(2);
  unwrap(sqlite3_exec(db, ptr(encoder.encode(sql + "\0")), 0, 0, ptr(_pErr)));
}

exec("PRAGMA auto_vacuum = none");
exec("PRAGMA temp_store = memory");
exec("PRAGMA locking_mode = exclusive");
exec("PRAGMA user_version = 100");

let total = parseInt(process.argv[2], 10);
const runs = parseInt(process.argv[3], 10);

function bench(query) {
  const start = Date.now();
  for (let i = 0; i < runs; i++) query();
  const elapsed = Date.now() - start;
  const rate = Math.floor(runs / (elapsed / 1000));
  console.log(`time ${elapsed} ms rate ${rate}`);
  if (--total) process.nextTick(() => bench(query));
}

function prepareStatement() {
  const pHandle = new Uint32Array(2);
  const s = encoder.encode("PRAGMA user_version");
  unwrap(
    sqlite3_prepare_v2(
      db,
      ptr(s),
      s.byteLength,
      ptr(pHandle),
      0,
    ),
  );
  return pHandle[0] + 2 ** 32 * pHandle[1];
}

const prepared = prepareStatement();

function run() {
  sqlite3_step(prepared);
  const int = sqlite3_column_int(prepared, 0);
  sqlite3_reset(prepared);
  return int;
}

console.log(`user_version: ${run()}`);

bench(run);
