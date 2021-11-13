import {
  read_cstr,
  sqlite3_close_v2,
  sqlite3_column_count,
  sqlite3_column_text,
  sqlite3_column_type,
  sqlite3_finalize,
  sqlite3_open_v2,
  sqlite3_prepare_v3,
  SQLITE3_ROW,
  sqlite3_step,
} from "../mod.ts";

console.log("sqlite3_open_v2");
const db = sqlite3_open_v2("test.db");

console.log("sqlite3_prepare_v3");
const stmt = sqlite3_prepare_v3(db, "select sqlite_version()");

while (sqlite3_step(db, stmt) == SQLITE3_ROW) {
  console.log("sqlite3_step");
  console.log("sqlite3_column_count", sqlite3_column_count(stmt));
  console.log("sqlite3_column_type", sqlite3_column_type(stmt, 0));
  console.log(
    "sqlite_column_text",
    read_cstr(BigInt(sqlite3_column_text(stmt, 0))),
  );
}

console.log("sqlite3_finalize");
sqlite3_finalize(db, stmt);

console.log("sqlite3_close_v2");
sqlite3_close_v2(db);
