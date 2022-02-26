import {
  sqlite3_blob,
  sqlite3_blob_bytes,
  sqlite3_blob_close,
  sqlite3_blob_read,
  sqlite3_blob_read_async,
  sqlite3_blob_write,
  sqlite3_blob_write_async,
} from "./ffi.ts";

/**
 * Enumerates SQLite3 Blob opened for streamed I/O.
 *
 * BLOB columns still return a `Uint8Array` of the data.
 * You can instead open this from `Database.openBlob()`.
 *
 * @see https://www.sqlite.org/c3ref/blob_open.html
 */
export class SQLBlob {
  #handle: sqlite3_blob;

  constructor(handle: sqlite3_blob) {
    this.#handle = handle;
  }

  /** Byte size of the Blob */
  get byteLength(): number {
    return sqlite3_blob_bytes(this.#handle);
  }

  /** Read from the Blob at given offset into a buffer (Uint8Array) */
  readSync(offset: number, p: Uint8Array): void {
    sqlite3_blob_read(this.#handle, p, offset, p.byteLength);
  }

  /** Write a buffer (Uint8Array) at given offset in the Blob */
  writeSync(offset: number, p: Uint8Array): void {
    sqlite3_blob_write(this.#handle, p, offset, p.byteLength);
  }

  /**
   * Read asynchronously from the Blob at given offset into a buffer.
   *
   * This function suspends sqlite3_blob_read function into a separate
   * thread, so beware of data races. Once you pass a buffer it should
   * not be used until this function resolves.
   */
  async read(offset: number, p: Uint8Array): Promise<void> {
    await sqlite3_blob_read_async(this.#handle, p, offset, p.byteLength);
  }

  /**
   * Write a buffer (Uint8Array) at given offset in the Blob.
   */
  async write(offset: number, p: Uint8Array): Promise<void> {
    await sqlite3_blob_write_async(this.#handle, p, offset, p.byteLength);
  }

  /** Close the Blob. It **must** be called to prevent leaks. */
  close(): void {
    sqlite3_blob_close(this.#handle);
  }

  /** Obtains Web Stream for reading the Blob */
  get readable(): ReadableStream<Uint8Array> {
    const length = this.byteLength;
    let offset = 0;
    return new ReadableStream({
      type: "bytes",
      pull: async (ctx) => {
        try {
          const byob = ctx.byobRequest;
          if (byob) {
            const toRead = Math.min(
              length - offset,
              byob.view!.byteLength,
            );
            await this.read(
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
            await this.read(offset, buffer);
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
      write: async (chunk, ctx) => {
        if (offset + chunk.byteLength > length) {
          ctx.error(new Error("Write exceeds blob length"));
          return;
        }
        await this.write(offset, chunk);
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

  async *[Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array> {
    const length = this.byteLength;
    let offset = 0;
    while (offset < length) {
      const toRead = Math.min(length - offset, 1024 * 16);
      const buffer = new Uint8Array(toRead);
      await this.read(offset, buffer);
      offset += toRead;
      yield buffer;
    }
  }

  [Symbol.for("Deno.customInspect")](): string {
    return `SQLite3.Blob(0x${this.byteLength.toString(16)})`;
  }
}
