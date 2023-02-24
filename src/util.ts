import { SQLITE3_MISUSE, SQLITE3_OK } from "./constants.ts";
import ffi from "./ffi.ts";

const {
  sqlite3_errmsg,
  sqlite3_errstr,
} = ffi;

export const encoder = new TextEncoder();

export function toCString(str: string): Uint8Array {
  return encoder.encode(str + "\0");
}

export function isObject(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

export class SqliteError extends Error {
  name = "SqliteError";

  constructor(
    public code: number = 1,
    message: string = "Unknown Error",
  ) {
    super(`${code}: ${message}`);
  }
}

export function unwrap(code: number, db?: Deno.PointerValue): void {
  if (code === SQLITE3_OK) return;
  if (code === SQLITE3_MISUSE) {
    throw new SqliteError(code, "SQLite3 API misuse");
  } else if (db !== undefined) {
    const errmsg = sqlite3_errmsg(db);
    if (errmsg === null) throw new SqliteError(code);
    throw new Error(Deno.UnsafePointerView.getCString(sqlite3_errmsg(db)!));
  } else {
    throw new SqliteError(
      code,
      Deno.UnsafePointerView.getCString(sqlite3_errstr(code)!),
    );
  }
}

export const buf = Deno.UnsafePointerView.getArrayBuffer;

export const readCstr = Deno.UnsafePointerView.getCString;
