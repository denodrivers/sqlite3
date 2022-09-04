#include "sqlite3.h"

char* iflagptr = 0;
sqlite3_int64* outintptr = 0;

void fastconfig(char* flag, sqlite3_int64* outint) {
  iflagptr = flag;
  outintptr = outint;
}

int sqlite3_column_int_fast(sqlite3_stmt *pStmt, int iCol){
  sqlite3_int64 i64 = sqlite3_column_int64(pStmt, iCol);
  if (i64 > 0x7fffffff) {
    *iflagptr = 1;
    *outintptr = i64;
  } else {
    *iflagptr = 0;
    return (int)i64;
  }
}
