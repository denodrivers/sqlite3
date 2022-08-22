import ffi from "./ffi.ts";
import { fromFileUrl } from "../deps.ts";
import {
  SQLITE3_OPEN_CREATE,
  SQLITE3_OPEN_MEMORY,
  SQLITE3_OPEN_READONLY,
  SQLITE3_OPEN_READWRITE,
} from "./constants.ts";
import { buf, readCstr, toCString, unwrap } from "./util.ts";
import { Statement } from "./statement.ts";

/** Various options that can be configured when opening Database connection. */
export interface DatabaseOpenOptions {
  /** Whether to open database only in read-only mode. By default, this is false. */
  readonly?: boolean;
  /** Whether to create a new database file at specified path if one does not exist already. By default this is true. */
  create?: boolean;
  /** Raw SQLite C API flags. Specifying this ignores all other options. */
  flags?: number;
  /** Opens an in-memory database. */
  memory?: boolean;
}

const {
  sqlite3_open_v2,
  sqlite3_close_v2,
  sqlite3_changes,
  sqlite3_total_changes,
  sqlite3_last_insert_rowid,
  sqlite3_get_autocommit,
  sqlite3_exec,
  sqlite3_free,
  sqlite3_serialize,
} = ffi;

const main = toCString("main");

export class Database {
  #path: string;
  #handle: Deno.PointerValue;

  get unsafeHandle(): Deno.PointerValue {
    return this.#handle;
  }

  get path(): string {
    return this.#path;
  }

  get changes(): number {
    return sqlite3_changes(this.#handle);
  }

  get totalChanges(): number {
    return sqlite3_total_changes(this.#handle);
  }

  get lastInsertRowId(): number {
    return Number(sqlite3_last_insert_rowid(this.#handle));
  }

  get autocommit(): boolean {
    return sqlite3_get_autocommit(this.#handle) === 1;
  }

  constructor(path: string | URL, options: DatabaseOpenOptions = {}) {
    this.#path = path instanceof URL ? fromFileUrl(path) : path;
    let flags = 0;
    if (options.flags !== undefined) {
      flags = options.flags;
    } else {
      if (options.memory) {
        flags |= SQLITE3_OPEN_MEMORY;
      }

      if (options.readonly ?? false) {
        flags |= SQLITE3_OPEN_READONLY;
      } else {
        flags |= SQLITE3_OPEN_READWRITE;
      }

      if (options.create ?? true) {
        flags |= SQLITE3_OPEN_CREATE;
      }
    }

    const pHandle = new Uint32Array(2);
    unwrap(sqlite3_open_v2(toCString(this.#path), pHandle, flags, 0));

    this.#handle = pHandle[0] + 2 ** 32 * pHandle[1];
  }

  serialize(name?: string): ArrayBuffer {
    const piSize = new BigInt64Array([-1n]);
    const piSizeBuffer = new Uint8Array(piSize.buffer);
    const ptr = sqlite3_serialize(
      this.#handle,
      name ? toCString(name) : main,
      piSizeBuffer,
      0,
    );
    return buf(ptr, Number(piSize[0]));
  }

  prepare(sql: string): Statement {
    return new Statement(this, sql);
  }

  exec(sql: string): void {
    const pErr = new Uint32Array(2);
    sqlite3_exec(this.#handle, toCString(sql), 0, 0, pErr);
    const errPtr = pErr[0] + 2 ** 32 * pErr[1];
    if (errPtr !== 0) {
      const err = readCstr(errPtr);
      sqlite3_free(errPtr);
      throw new Error(err);
    }
  }

  run(sql: string): void {
    this.exec(sql);
  }

  transaction(fn): any {
    // Based on https://github.com/WiseLibs/better-sqlite3/blob/master/lib/methods/transaction.js
    const controller = getController(this);

    // Each version of the transaction function has these same properties
    const properties = {
      default: { value: wrapTransaction(fn, this, controller.default) },
      deferred: { value: wrapTransaction(fn, this, controller.deferred) },
      immediate: { value: wrapTransaction(fn, this, controller.immediate) },
      exclusive: { value: wrapTransaction(fn, this, controller.exclusive) },
      database: { value: this, enumerable: true },
    };

    Object.defineProperties(properties.default.value, properties);
    Object.defineProperties(properties.deferred.value, properties);
    Object.defineProperties(properties.immediate.value, properties);
    Object.defineProperties(properties.exclusive.value, properties);

    // Return the default version of the transaction function
    return properties.default.value;
  }

  close(): void {
    unwrap(sqlite3_close_v2(this.#handle));
  }
}

const controllers = new WeakMap();

// Return the database's cached transaction controller, or create a new one
const getController = (db: Database) => {
  let controller = controllers.get(db);
  if (!controller) {
    const shared = {
      commit: db.prepare("COMMIT"),
      rollback: db.prepare("ROLLBACK"),
      savepoint: db.prepare("SAVEPOINT `\t_bs3.\t`"),
      release: db.prepare("RELEASE `\t_bs3.\t`"),
      rollbackTo: db.prepare("ROLLBACK TO `\t_bs3.\t`"),
    };

    controllers.set(
      db,
      controller = {
        default: Object.assign(
          { begin: db.prepare("BEGIN") },
          shared,
        ),
        deferred: Object.assign(
          { begin: db.prepare("BEGIN DEFERRED") },
          shared,
        ),
        immediate: Object.assign(
          { begin: db.prepare("BEGIN IMMEDIATE") },
          shared,
        ),
        exclusive: Object.assign(
          { begin: db.prepare("BEGIN EXCLUSIVE") },
          shared,
        ),
      },
    );
  }
  return controller;
};

// Return a new transaction function by wrapping the given function
const wrapTransaction = (
  fn: any,
  db: Database,
  { begin, commit, rollback, savepoint, release, rollbackTo }: any,
) =>
  function sqliteTransaction(): Statement {
    const { apply } = Function.prototype;
    let before, after, undo;
    if (!db.autocommit) {
      before = savepoint;
      after = release;
      undo = rollbackTo;
    } else {
      before = begin;
      after = commit;
      undo = rollback;
    }
    before.run();
    try {
      const result = apply.call(fn, this, arguments);
      after.run();
      return result;
    } catch (ex) {
      if (!db.autocommit) {
        undo.run();
        if (undo !== rollback) after.run();
      }
      throw ex;
    }
  };
