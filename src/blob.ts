import type { Database } from "./database.ts";
import ffi from "./ffi.ts";
import { toCString, unwrap } from "./util.ts";

const {
  sqlite3_blob_open,
  sqlite3_blob_bytes,
  sqlite3_blob_close,
  sqlite3_blob_read,
  sqlite3_blob_read_async,
  sqlite3_blob_write,
  sqlite3_blob_write_async,
} = ffi;

/** Various options that can be configured when opening a Blob via `Database#openBlob`. */
export interface BlobOpenOptions {
  /** Whether to open Blob in readonly mode. True by default. */
  readonly?: boolean;
  /** Database to open Blob from, "main" by default. */
  db?: string;
  /** Table the Blob is in */
  table: string;
  /** Column name of the Blob Field */
  column: string;
  /** Row ID of which column to select */
  row: number;
}

/**
 * Enumerates SQLite3 Blob opened for streamed I/O.
 *
 * BLOB columns still return a `Uint8Array` of the data.
 * You can instead open this from `Database.openBlob()`.
 *
 * @see https://www.sqlite.org/c3ref/blob_open.html
 */
export class SQLBlob {
  #handle: Deno.PointerValue;

  constructor(db: Database, options: BlobOpenOptions) {
    options = Object.assign({
      readonly: true,
      db: "main",
    }, options);
    const pHandle = new Uint32Array(2);
    unwrap(sqlite3_blob_open(
      db.unsafeHandle,
      toCString(options.db ?? "main"),
      toCString(options.table),
      toCString(options.column),
      options.row,
      options.readonly === false ? 1 : 0,
      pHandle,
    ));
    this.#handle = pHandle[0] + 2 ** 32 * pHandle[1];
  }

  /** Byte size of the Blob */
  get byteLength(): number {
    return sqlite3_blob_bytes(this.#handle);
  }

  /** Read from the Blob at given offset into a buffer (Uint8Array) */
  readSync(offset: number, p: Uint8Array): void {
    unwrap(sqlite3_blob_read(this.#handle, p, p.byteLength, offset));
  }

  /** Write a buffer (Uint8Array) at given offset in the Blob */
  writeSync(offset: number, p: Uint8Array): void {
    unwrap(sqlite3_blob_write(this.#handle, p, p.byteLength, offset));
  }

  /**
   * Read asynchronously from the Blob at given offset into a buffer.
   *
   * This function suspends sqlite3_blob_read function into a separate
   * thread, so beware of data races. Once you pass a buffer it should
   * not be used until this function resolves.
   */
  async read(offset: number, p: Uint8Array): Promise<void> {
    unwrap(
      await sqlite3_blob_read_async(
        this.#handle,
        p,
        p.byteLength,
        offset,
      ),
    );
  }

  /**
   * Write a buffer (Uint8Array) at given offset in the Blob.
   */
  async write(offset: number, p: Uint8Array): Promise<void> {
    unwrap(
      await sqlite3_blob_write_async(this.#handle, p, p.byteLength, offset),
    );
  }

  /** Close the Blob. It **must** be called to prevent leaks. */
  close(): void {
    unwrap(sqlite3_blob_close(this.#handle));
  }

  /** Obtains Web Stream for reading the Blob */
  get readable(): ReadableStream<Uint8Array> {
    const length = this.byteLength;
    let offset = 0;
    return new ReadableStream({
      type: "bytes",
      pull: (ctx) => {
        try {
          const byob = ctx.byobRequest;
          if (byob) {
            const toRead = Math.min(
              length - offset,
              byob.view!.byteLength,
            );
            this.readSync(
              offset,
              (byob.view as Uint8Array).subarray(0, toRead),
            );
            offset += toRead;
            byob.respond(toRead);
          } else {
            const toRead = Math.min(
              length - offset,
              ctx.desiredSize || 1024 * 16,
            );
            if (toRead === 0) {
              ctx.close();
              return;
            }
            const buffer = new Uint8Array(toRead);
            this.readSync(offset, buffer);
            offset += toRead;
            ctx.enqueue(buffer);
          }
        } catch (e) {
          ctx.error(e);
          ctx.byobRequest?.respond(0);
        }
      },
    });
  }

  /** Obtains Web Stream for writing to the Blob */
  get writable(): WritableStream<Uint8Array> {
    const length = this.byteLength;
    let offset = 0;
    return new WritableStream({
      write: (chunk, ctx) => {
        if (offset + chunk.byteLength > length) {
          ctx.error(new Error("Write exceeds blob length"));
          return;
        }
        this.writeSync(offset, chunk);
        offset += chunk.byteLength;
      },
    });
  }

  *[Symbol.iterator](): IterableIterator<Uint8Array> {
    const length = this.byteLength;
    let offset = 0;
    while (offset < length) {
      const toRead = Math.min(length - offset, 1024 * 16);
      const buffer = new Uint8Array(toRead);
      this.readSync(offset, buffer);
      offset += toRead;
      yield buffer;
    }
  }

  [Symbol.for("Deno.customInspect")](): string {
    return `SQLite3.Blob(0x${this.byteLength.toString(16)})`;
  }
}
