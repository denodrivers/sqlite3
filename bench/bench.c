#include <sqlite3.h>
#include <stdio.h>
#include <time.h>
#include <stdlib.h>

int total = 5;
int count = 1000000;

int get_version (sqlite3_stmt* stmt) {
  if (sqlite3_step(stmt) == SQLITE_ROW) {
    int val = sqlite3_column_int(stmt, 0);
    sqlite3_reset(stmt);
    return val;
  }
  sqlite3_finalize(stmt);
  return 0;
}

void bench (sqlite3_stmt* stmt) {
  float start, end;
  start = (float)clock() / (CLOCKS_PER_SEC / 1000);
  for (int i = 0; i < count; i++) get_version(stmt);
  end = (float)clock() / (CLOCKS_PER_SEC / 1000);
  printf("time %.0f ms rate %.0f\n", (end - start), count / ((end - start) / 1000));
}

int main (int argc, char** argv) {
  if (argc > 1) total = atoi(argv[1]);
  if (argc > 2) count = atoi(argv[2]);
  sqlite3_initialize();
  sqlite3* db;
  int flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_PRIVATECACHE | SQLITE_OPEN_NOMUTEX | SQLITE_OPEN_CREATE;
  sqlite3_open_v2(":memory:", &db, flags, NULL);
  sqlite3_stmt* stmt;
  sqlite3_prepare_v2(db, "pragma user_version", -1, &stmt, 0);
  char *err_msg = 0;
  sqlite3_exec(db, "PRAGMA auto_vacuum = none", 0, 0, &err_msg);
  sqlite3_exec(db, "PRAGMA temp_store = memory", 0, 0, &err_msg);
  sqlite3_exec(db, "PRAGMA locking_mode = exclusive", 0, 0, &err_msg);
  sqlite3_exec(db, "PRAGMA user_version = 100", 0, 0, &err_msg);
  while (total--) bench(stmt);
  sqlite3_finalize(stmt);
  sqlite3_close(db);
  sqlite3_shutdown();
}