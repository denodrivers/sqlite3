// Result Codes
export const SQLITE3_OK = 0;
export const SQLITE3_ERROR = 1;
export const SQLITE3_INTERNAL = 2;
export const SQLITE3_PERM = 3;
export const SQLITE3_ABORT = 4;
export const SQLITE3_BUSY = 5;
export const SQLITE3_LOCKED = 6;
export const SQLITE3_NOMEM = 7;
export const SQLITE3_READONLY = 8;
export const SQLITE3_INTERRUPT = 9;
export const SQLITE3_IOERR = 10;
export const SQLITE3_CORRUPT = 11;
export const SQLITE3_NOTFOUND = 12;
export const SQLITE3_FULL = 13;
export const SQLITE3_CANTOPEN = 14;
export const SQLITE3_PROTOCOL = 15;
export const SQLITE3_EMPTY = 16;
export const SQLITE3_SCHEMA = 17;
export const SQLITE3_TOOBIG = 18;
export const SQLITE3_CONSTRAINT = 19;
export const SQLITE3_MISMATCH = 20;
export const SQLITE3_MISUSE = 21;
export const SQLITE3_NOLFS = 22;
export const SQLITE3_AUTH = 23;
export const SQLITE3_FORMAT = 24;
export const SQLITE3_RANGE = 25;
export const SQLITE3_NOTADB = 26;
export const SQLITE3_NOTICE = 27;
export const SQLITE3_WARNING = 28;
export const SQLITE3_ROW = 100;
export const SQLITE3_DONE = 101;

// Open Flags
export const SQLITE3_OPEN_READONLY = 0x00000001;
export const SQLITE3_OPEN_READWRITE = 0x00000002;
export const SQLITE3_OPEN_CREATE = 0x00000004;
export const SQLITE3_OPEN_DELETEONCLOSE = 0x00000008;
export const SQLITE3_OPEN_EXCLUSIVE = 0x00000010;
export const SQLITE3_OPEN_AUTOPROXY = 0x00000020;
export const SQLITE3_OPEN_URI = 0x00000040;
export const SQLITE3_OPEN_MEMORY = 0x00000080;
export const SQLITE3_OPEN_MAIN_DB = 0x00000100;
export const SQLITE3_OPEN_TEMP_DB = 0x00000200;
export const SQLITE3_OPEN_TRANSIENT_DB = 0x00000400;
export const SQLITE3_OPEN_MAIN_JOURNAL = 0x00000800;
export const SQLITE3_OPEN_TEMP_JOURNAL = 0x00001000;
export const SQLITE3_OPEN_SUBJOURNAL = 0x00002000;
export const SQLITE3_OPEN_SUPER_JOURNAL = 0x00004000;
export const SQLITE3_OPEN_NONMUTEX = 0x00008000;
export const SQLITE3_OPEN_FULLMUTEX = 0x00010000;
export const SQLITE3_OPEN_SHAREDCACHE = 0x00020000;
export const SQLITE3_OPEN_PRIVATECACHE = 0x00040000;
export const SQLITE3_OPEN_WAL = 0x00080000;
export const SQLITE3_OPEN_NOFOLLOW = 0x01000000;

// Prepare Flags
export const SQLITE3_PREPARE_PERSISTENT = 0x00000001;
export const SQLITE3_PREPARE_NORMALIZE = 0x00000002;
export const SQLITE3_PREPARE_NO_VTAB = 0x00000004;

// Fundamental Datatypes
export const SQLITE_INTEGER = 1;
export const SQLITE_FLOAT = 2;
export const SQLITE_TEXT = 3;
export const SQLITE_BLOB = 4;
export const SQLITE_NULL = 5;
