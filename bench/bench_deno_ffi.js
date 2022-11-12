import ffi from "../src/ffi.ts";
import { toCString, unwrap } from "../src/util.ts";
import {
  SQLITE3_OPEN_CREATE,
  SQLITE3_OPEN_MEMORY,
  SQLITE3_OPEN_PRIVATECACHE,
  SQLITE3_OPEN_READWRITE,
} from "../src/constants.ts";

const {
  sqlite3_open_v2,
  sqlite3_exec,
  sqlite3_prepare_v2,
  sqlite3_reset,
  sqlite3_step,
  sqlite3_column_int,
} = ffi;

const pHandle = new Uint32Array(2);
unwrap(
  sqlite3_open_v2(
    toCString(":memory:"),
    pHandle,
    SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_PRIVATECACHE |
      SQLITE3_OPEN_CREATE | SQLITE3_OPEN_MEMORY,
    0,
  ),
);
const db = pHandle[0] + 2 ** 32 * pHandle[1];

import { nextTick } from "https://deno.land/std@0.126.0/node/_next_tick.ts";

function exec(sql) {
  const _pErr = new Uint32Array(2);
  unwrap(sqlite3_exec(db, toCString(sql), 0, 0, _pErr));
}

exec("PRAGMA auto_vacuum = none");
exec("PRAGMA temp_store = memory");
exec("PRAGMA locking_mode = exclusive");
exec("PRAGMA user_version = 100");

const sql = "pragma user_version";

let total = parseInt(Deno.args[0], 10);
const runs = parseInt(Deno.args[1], 10);

function bench(query) {
  const start = Date.now();
  for (let i = 0; i < runs; i++) query();
  const elapsed = Date.now() - start;
  const rate = Math.floor(runs / (elapsed / 1000));
  console.log(`time ${elapsed} ms rate ${rate}`);
  if (--total) bench(query);
}

function prepareStatement() {
  const pHandle = new Uint32Array(2);
  unwrap(
    sqlite3_prepare_v2(
      db,
      toCString(sql),
      sql.length,
      pHandle,
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
