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

const ops = (Deno as any)[(Deno as any).internal].core.ops;
const { op_ffi_cstr_read, op_ffi_get_buf } = ops;

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
    if (errmsg === 0) throw new SqliteError(code);
    throw new Error(op_ffi_cstr_read(sqlite3_errmsg(db)));
  } else throw new SqliteError(code, op_ffi_cstr_read(sqlite3_errstr(code)));
}

export { op_ffi_cstr_read as readCstr, op_ffi_get_buf as buf };
