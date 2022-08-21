import type { Database } from "./database.ts";
import { readCstr, toCString, unwrap } from "./util.ts";
import ffi from "./ffi.ts";
import {
  SQLITE3_DONE,
  SQLITE3_ROW,
  SQLITE_BLOB,
  SQLITE_FLOAT,
  SQLITE_INTEGER,
  SQLITE_TEXT,
} from "./constants.ts";

const {
  sqlite3_prepare_v2,
  sqlite3_reset,
  sqlite3_clear_bindings,
  sqlite3_step,
  sqlite3_column_count,
  sqlite3_column_type,
  sqlite3_column_text,
  sqlite3_finalize,
  sqlite3_column_int,
  sqlite3_column_double,
  sqlite3_column_blob,
  sqlite3_column_bytes,
  sqlite3_column_name,
} = ffi;

export class Statement {
  #handle: Deno.PointerValue;

  constructor(db: Database, sql: string) {
    const pHandle = new Uint32Array(2);
    unwrap(
      sqlite3_prepare_v2(
        db.unsafeHandle,
        toCString(sql),
        sql.length,
        pHandle,
        0,
      ),
    );
    this.#handle = pHandle[0] + 2 ** 32 * pHandle[1];
  }

  #begin(params?: any[] | Record<string, any>): void {
    sqlite3_reset(this.#handle);
    sqlite3_clear_bindings(this.#handle);

    if (params !== undefined) {
      // todo
    }
  }

  #getColumn(i: number): any {
    switch (sqlite3_column_type(this.#handle, i)) {
      case SQLITE_TEXT: {
        const ptr = sqlite3_column_text(this.#handle, i);
        if (ptr === 0) return null;
        return readCstr(ptr);
      }

      case SQLITE_INTEGER: {
        return sqlite3_column_int(this.#handle, i);
      }

      case SQLITE_FLOAT: {
        return sqlite3_column_double(this.#handle, i);
      }

      case SQLITE_BLOB: {
        const ptr = sqlite3_column_blob(this.#handle, i);
        const bytes = sqlite3_column_bytes(this.#handle, i);
        return new Uint8Array(
          new Deno.UnsafePointerView(BigInt(ptr)).getArrayBuffer(bytes)
            .slice(0),
        );
      }

      default: {
        return null;
      }
    }
  }

  raw<T extends Array<unknown>>(): T[] {
    this.#begin();
    const columnCount = sqlite3_column_count(this.#handle);
    const result: T[] = [];
    const getRowArray = new Function(
      "getColumn",
      `
      return function() {
        return [${
        Array.from({ length: columnCount }).map((_, i) => `getColumn(${i})`)
          .join(", ")
      }];
      };
      `,
    )(this.#getColumn.bind(this));
    let status = sqlite3_step(this.#handle);
    while (status === SQLITE3_ROW) {
      result.push(getRowArray());
      status = sqlite3_step(this.#handle);
    }
    if (status !== SQLITE3_DONE) {
      unwrap(status);
    }
    return result as T[];
  }

  all<T extends Record<string, unknown>>(): T[] {
    this.#begin();
    const columnCount = sqlite3_column_count(this.#handle);
    const columnNames = new Array(columnCount);
    for (let i = 0; i < columnCount; i++) {
      columnNames[i] = readCstr(sqlite3_column_name(this.#handle, i));
    }
    const result: T[] = [];
    const getRowObject = new Function(
      "getColumn",
      `
      return function() {
        return {
          ${
        columnNames.map((name, i) => `"${name}": getColumn(${i})`).join(",\n")
      }
        };
      };
      `,
    )(this.#getColumn.bind(this));
    let status = sqlite3_step(this.#handle);
    while (status === SQLITE3_ROW) {
      result.push(getRowObject());
      status = sqlite3_step(this.#handle);
    }
    if (status !== SQLITE3_DONE) {
      unwrap(status);
    }
    return result as T[];
  }

  finalize(): void {
    unwrap(sqlite3_finalize(this.#handle));
  }
}
