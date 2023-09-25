import ffi from "./ffi.ts";
import { fromFileUrl } from "../deps.ts";
import {
  SQLITE3_OPEN_CREATE,
  SQLITE3_OPEN_MEMORY,
  SQLITE3_OPEN_READONLY,
  SQLITE3_OPEN_READWRITE,
  SQLITE_BLOB,
  SQLITE_FLOAT,
  SQLITE_INTEGER,
  SQLITE_NULL,
  SQLITE_TEXT,
} from "./constants.ts";
import { readCstr, toCString, unwrap } from "./util.ts";
import { RestBindParameters, Statement, STATEMENTS } from "./statement.ts";
import { BlobOpenOptions, SQLBlob } from "./blob.ts";

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
  /** Whether to support BigInt columns. False by default, integers larger than 32 bit will be inaccurate. */
  int64?: boolean;
  /** Apply agressive optimizations that are not possible with concurrent clients. */
  unsafeConcurrency?: boolean;
  /** Enable or disable extension loading */
  enableLoadExtension?: boolean;
}

/** Transaction function created using `Database#transaction`. */
export type Transaction<T extends (...args: any[]) => void> =
  & ((...args: Parameters<T>) => ReturnType<T>)
  & {
    /** BEGIN */
    default: Transaction<T>;
    /** BEGIN DEFERRED */
    deferred: Transaction<T>;
    /** BEGIN IMMEDIATE */
    immediate: Transaction<T>;
    /** BEGIN EXCLUSIVE */
    exclusive: Transaction<T>;
    database: Database;
  };

/**
 * Options for user-defined functions.
 *
 * @link https://www.sqlite.org/c3ref/c_deterministic.html
 */
export interface FunctionOptions {
  varargs?: boolean;
  deterministic?: boolean;
  directOnly?: boolean;
  innocuous?: boolean;
  subtype?: boolean;
}

export interface AggregateFunctionOptions extends FunctionOptions {
  start: any | (() => any);
  step: (aggregate: any, ...args: any[]) => void;
  final?: (aggregate: any) => any;
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
  sqlite3_libversion,
  sqlite3_sourceid,
  sqlite3_complete,
  sqlite3_finalize,
  sqlite3_result_blob,
  sqlite3_result_double,
  sqlite3_result_error,
  sqlite3_result_int64,
  sqlite3_result_null,
  sqlite3_result_text,
  sqlite3_value_blob,
  sqlite3_value_bytes,
  sqlite3_value_double,
  sqlite3_value_int64,
  sqlite3_value_text,
  sqlite3_value_type,
  sqlite3_create_function,
  sqlite3_result_int,
  sqlite3_aggregate_context,
  sqlite3_enable_load_extension,
  sqlite3_load_extension,
} = ffi;

/** SQLite version string */
export const SQLITE_VERSION = readCstr(sqlite3_libversion()!);
/** SQLite source ID string */
export const SQLITE_SOURCEID = readCstr(sqlite3_sourceid()!);

/**
 * Whether the given SQL statement is complete.
 *
 * @param statement SQL statement string
 */
export function isComplete(statement: string): boolean {
  return Boolean(sqlite3_complete(toCString(statement)));
}

/**
 * Represents a SQLite3 database connection.
 *
 * Example:
 * ```ts
 * // Open a database from file, creates if doesn't exist.
 * const db = new Database("myfile.db");
 *
 * // Open an in-memory database.
 * const db = new Database(":memory:");
 *
 * // Open a read-only database.
 * const db = new Database("myfile.db", { readonly: true });
 *
 * // Or open using File URL
 * const db = new Database(new URL("./myfile.db", import.meta.url));
 * ```
 */
export class Database {
  #path: string;
  #handle: Deno.PointerValue;
  #open = true;
  #enableLoadExtension = false;

  /** Whether to support BigInt columns. False by default, integers larger than 32 bit will be inaccurate. */
  int64: boolean;

  unsafeConcurrency: boolean;

  /** Whether DB connection is open */
  get open(): boolean {
    return this.#open;
  }

  /** Unsafe Raw (pointer) to the sqlite object */
  get unsafeHandle(): Deno.PointerValue {
    return this.#handle;
  }

  /** Path of the database file. */
  get path(): string {
    return this.#path;
  }

  /** Number of rows changed by the last executed statement. */
  get changes(): number {
    return sqlite3_changes(this.#handle);
  }

  /** Number of rows changed since the database connection was opened. */
  get totalChanges(): number {
    return sqlite3_total_changes(this.#handle);
  }

  /** Gets last inserted Row ID */
  get lastInsertRowId(): number {
    return Number(sqlite3_last_insert_rowid(this.#handle));
  }

  /** Whether autocommit is enabled. Enabled by default, can be disabled using BEGIN statement. */
  get autocommit(): boolean {
    return sqlite3_get_autocommit(this.#handle) === 1;
  }

  /** Whether DB is in mid of a transaction */
  get inTransaction(): boolean {
    return this.#open && !this.autocommit;
  }

  get enableLoadExtension(): boolean {
    return this.#enableLoadExtension;
  }

  // deno-lint-ignore explicit-module-boundary-types
  set enableLoadExtension(enabled: boolean) {
    const result = sqlite3_enable_load_extension(this.#handle, Number(enabled));
    unwrap(result, this.#handle);
    this.#enableLoadExtension = enabled;
  }

  constructor(path: string | URL, options: DatabaseOpenOptions = {}) {
    this.#path = path instanceof URL ? fromFileUrl(path) : path;
    let flags = 0;
    this.int64 = options.int64 ?? false;
    this.unsafeConcurrency = options.unsafeConcurrency ?? false;
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

      if ((options.create ?? true) && !options.readonly) {
        flags |= SQLITE3_OPEN_CREATE;
      }
    }

    const pHandle = new Uint32Array(2);
    const result = sqlite3_open_v2(toCString(this.#path), pHandle, flags, null);
    this.#handle = Deno.UnsafePointer.create(pHandle[0] + 2 ** 32 * pHandle[1]);
    if (result !== 0) sqlite3_close_v2(this.#handle);
    unwrap(result);

    if (options.enableLoadExtension) {
      this.enableLoadExtension = options.enableLoadExtension;
    }
  }

  /**
   * Creates a new Prepared Statement from the given SQL statement.
   *
   * Example:
   * ```ts
   * const stmt = db.prepare("SELECT * FROM mytable WHERE id = ?");
   *
   * for (const row of stmt.all(1)) {
   *   console.log(row);
   * }
   * ```
   *
   * Bind parameters can be either provided as an array of values, or as an object
   * mapping the parameter name to the value.
   *
   * Example:
   * ```ts
   * const stmt = db.prepare("SELECT * FROM mytable WHERE id = ?");
   * const row = stmt.get(1);
   *
   * // or
   *
   * const stmt = db.prepare("SELECT * FROM mytable WHERE id = :id");
   * const row = stmt.get({ id: 1 });
   * ```
   *
   * Statements are automatically freed once GC catches them, however
   * you can also manually free using `finalize` method.
   *
   * @param sql SQL statement string
   * @returns Statement object
   */
  prepare(sql: string): Statement {
    return new Statement(this, sql);
  }

  /**
   * Open a Blob for incremental I/O.
   *
   * Make sure to close the blob after you are done with it,
   * otherwise you will have memory leaks.
   */
  openBlob(options: BlobOpenOptions): SQLBlob {
    return new SQLBlob(this, options);
  }

  /**
   * Simply executes the SQL statement (supports multiple statements separated by semicolon).
   * Returns the number of changes made by last statement.
   *
   * Example:
   * ```ts
   * // Create table
   * db.exec("create table users (id integer not null, username varchar(20) not null)");
   *
   * // Inserts
   * db.exec("insert into users (id, username) values(?, ?)", id, username);
   *
   * // Insert with named parameters
   * db.exec("insert into users (id, username) values(:id, :username)", { id, username });
   *
   * // Pragma statements
   * db.exec("pragma journal_mode = WAL");
   * db.exec("pragma synchronous = normal");
   * db.exec("pragma temp_store = memory");
   * ```
   *
   * Under the hood, it uses `sqlite3_exec` if no parameters are given to bind
   * with the SQL statement, a prepared statement otherwise.
   */
  exec(sql: string, ...params: RestBindParameters): number {
    if (params.length === 0) {
      const pErr = new Uint32Array(2);
      sqlite3_exec(
        this.#handle,
        toCString(sql),
        null,
        null,
        new Uint8Array(pErr.buffer),
      );
      const errPtr = Deno.UnsafePointer.create(pErr[0] + 2 ** 32 * pErr[1]);
      if (errPtr !== null) {
        const err = readCstr(errPtr);
        sqlite3_free(errPtr);
        throw new Error(err);
      }
      return sqlite3_changes(this.#handle);
    }

    const stmt = this.prepare(sql);
    stmt.run(...params);
    return sqlite3_changes(this.#handle);
  }

  /** Alias for `exec`. */
  run(sql: string, ...params: RestBindParameters): number {
    return this.exec(sql, ...params);
  }

  /** Safely execute SQL with parameters using a tagged template */
  sql<T extends Record<string, unknown> = Record<string, any>>(
    strings: TemplateStringsArray,
    ...parameters: RestBindParameters
  ): T[] {
    const sql = strings.join("?");
    const stmt = this.prepare(sql);
    return stmt.all(...parameters);
  }

  /**
   * Wraps a callback function in a transaction.
   *
   * - When function is called, the transaction is started.
   * - When function returns, the transaction is committed.
   * - When function throws an error, the transaction is rolled back.
   *
   * Example:
   * ```ts
   * const stmt = db.prepare("insert into users (id, username) values(?, ?)");
   *
   * interface User {
   *   id: number;
   *   username: string;
   * }
   *
   * const insertUsers = db.transaction((data: User[]) => {
   *   for (const user of data) {
   *     stmt.run(user);
   *   }
   * });
   *
   * insertUsers([
   *   { id: 1, username: "alice" },
   *   { id: 2, username: "bob" },
   * ]);
   *
   * // May also use `insertUsers.deferred`, `immediate`, or `exclusive`.
   * // They corresspond to using `BEGIN DEFERRED`, `BEGIN IMMEDIATE`, and `BEGIN EXCLUSIVE`.
   * // For eg.
   *
   * insertUsers.deferred([
   *   { id: 1, username: "alice" },
   *   { id: 2, username: "bob" },
   * ]);
   * ```
   */
  transaction<T extends (this: Transaction<T>, ...args: any[]) => void>(
    fn: T,
  ): Transaction<T> {
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
    return properties.default.value as Transaction<T>;
  }

  #callbacks = new Set<Deno.UnsafeCallback>();

  /**
   * Creates a new user-defined function.
   *
   * Example:
   * ```ts
   * db.function("add", (a: number, b: number) => a + b);
   * db.prepare("select add(1, 2)").value<[number]>()!; // [3]
   * ```
   */
  function(
    name: string,
    fn: CallableFunction,
    options?: FunctionOptions,
  ): void {
    const cb = new Deno.UnsafeCallback(
      {
        parameters: ["pointer", "i32", "pointer"],
        result: "void",
      } as const,
      (ctx, nArgs, pArgs) => {
        const argptr = new Deno.UnsafePointerView(pArgs!);
        const args: any[] = [];
        for (let i = 0; i < nArgs; i++) {
          const arg = Deno.UnsafePointer.create(
            Number(argptr.getBigUint64(i * 8)),
          );
          const type = sqlite3_value_type(arg);
          switch (type) {
            case SQLITE_INTEGER:
              args.push(sqlite3_value_int64(arg));
              break;
            case SQLITE_FLOAT:
              args.push(sqlite3_value_double(arg));
              break;
            case SQLITE_TEXT:
              args.push(
                new TextDecoder().decode(
                  new Uint8Array(
                    Deno.UnsafePointerView.getArrayBuffer(
                      sqlite3_value_text(arg)!,
                      sqlite3_value_bytes(arg),
                    ),
                  ),
                ),
              );
              break;
            case SQLITE_BLOB:
              args.push(
                new Uint8Array(
                  Deno.UnsafePointerView.getArrayBuffer(
                    sqlite3_value_blob(arg)!,
                    sqlite3_value_bytes(arg),
                  ),
                ),
              );
              break;
            case SQLITE_NULL:
              args.push(null);
              break;
            default:
              throw new Error(`Unknown type: ${type}`);
          }
        }

        let result: any;
        try {
          result = fn(...args);
        } catch (err) {
          const buf = new TextEncoder().encode(err.message);
          sqlite3_result_error(ctx, buf, buf.byteLength);
          return;
        }

        if (result === undefined || result === null) {
          sqlite3_result_null(ctx);
        } else if (typeof result === "boolean") {
          sqlite3_result_int(ctx, result ? 1 : 0);
        } else if (typeof result === "number") {
          if (Number.isSafeInteger(result)) sqlite3_result_int64(ctx, result);
          else sqlite3_result_double(ctx, result);
        } else if (typeof result === "bigint") {
          sqlite3_result_int64(ctx, result);
        } else if (typeof result === "string") {
          const buffer = new TextEncoder().encode(result);
          sqlite3_result_text(ctx, buffer, buffer.byteLength, 0);
        } else if (result instanceof Uint8Array) {
          sqlite3_result_blob(ctx, result, result.length, -1);
        } else {
          const buffer = new TextEncoder().encode(
            `Invalid return value: ${Deno.inspect(result)}`,
          );
          sqlite3_result_error(ctx, buffer, buffer.byteLength);
        }
      },
    );

    let flags = 1;

    if (options?.deterministic) {
      flags |= 0x000000800;
    }

    if (options?.directOnly) {
      flags |= 0x000080000;
    }

    if (options?.subtype) {
      flags |= 0x000100000;
    }

    if (options?.directOnly) {
      flags |= 0x000200000;
    }

    const err = sqlite3_create_function(
      this.#handle,
      toCString(name),
      options?.varargs ? -1 : fn.length,
      flags,
      null,
      cb.pointer,
      null,
      null,
    );

    unwrap(err, this.#handle);

    this.#callbacks.add(cb as Deno.UnsafeCallback);
  }

  /**
   * Creates a new user-defined aggregate function.
   */
  aggregate(name: string, options: AggregateFunctionOptions): void {
    const contexts = new Map<number | bigint, any>();

    const cb = new Deno.UnsafeCallback(
      {
        parameters: ["pointer", "i32", "pointer"],
        result: "void",
      } as const,
      (ctx, nArgs, pArgs) => {
        const aggrCtx = sqlite3_aggregate_context(ctx, 8);
        const aggrPtr = Deno.UnsafePointer.value(aggrCtx);
        let aggregate;
        if (contexts.has(aggrPtr)) {
          aggregate = contexts.get(aggrPtr);
        } else {
          aggregate = typeof options.start === "function"
            ? options.start()
            : options.start;
          contexts.set(aggrPtr, aggregate);
        }
        const argptr = new Deno.UnsafePointerView(pArgs!);
        const args: any[] = [];
        for (let i = 0; i < nArgs; i++) {
          const arg = Deno.UnsafePointer.create(
            Number(argptr.getBigUint64(i * 8)),
          );
          const type = sqlite3_value_type(arg);
          switch (type) {
            case SQLITE_INTEGER:
              args.push(sqlite3_value_int64(arg));
              break;
            case SQLITE_FLOAT:
              args.push(sqlite3_value_double(arg));
              break;
            case SQLITE_TEXT:
              args.push(
                new TextDecoder().decode(
                  new Uint8Array(
                    Deno.UnsafePointerView.getArrayBuffer(
                      sqlite3_value_text(arg)!,
                      sqlite3_value_bytes(arg),
                    ),
                  ),
                ),
              );
              break;
            case SQLITE_BLOB:
              args.push(
                new Uint8Array(
                  Deno.UnsafePointerView.getArrayBuffer(
                    sqlite3_value_blob(arg)!,
                    sqlite3_value_bytes(arg),
                  ),
                ),
              );
              break;
            case SQLITE_NULL:
              args.push(null);
              break;
            default:
              throw new Error(`Unknown type: ${type}`);
          }
        }

        let result: any;
        try {
          result = options.step(aggregate, ...args);
        } catch (err) {
          const buf = new TextEncoder().encode(err.message);
          sqlite3_result_error(ctx, buf, buf.byteLength);
          return;
        }

        contexts.set(aggrPtr, result);
      },
    );

    const cbFinal = new Deno.UnsafeCallback(
      {
        parameters: ["pointer"],
        result: "void",
      } as const,
      (ctx) => {
        const aggrCtx = sqlite3_aggregate_context(ctx, 0);
        const aggrPtr = Deno.UnsafePointer.value(aggrCtx);
        const aggregate = contexts.get(aggrPtr);
        contexts.delete(aggrPtr);
        let result: any;
        try {
          result = options.final ? options.final(aggregate) : aggregate;
        } catch (err) {
          const buf = new TextEncoder().encode(err.message);
          sqlite3_result_error(ctx, buf, buf.byteLength);
          return;
        }

        if (result === undefined || result === null) {
          sqlite3_result_null(ctx);
        } else if (typeof result === "boolean") {
          sqlite3_result_int(ctx, result ? 1 : 0);
        } else if (typeof result === "number") {
          if (Number.isSafeInteger(result)) sqlite3_result_int64(ctx, result);
          else sqlite3_result_double(ctx, result);
        } else if (typeof result === "bigint") {
          sqlite3_result_int64(ctx, result);
        } else if (typeof result === "string") {
          const buffer = new TextEncoder().encode(result);
          sqlite3_result_text(ctx, buffer, buffer.byteLength, 0);
        } else if (result instanceof Uint8Array) {
          sqlite3_result_blob(ctx, result, result.length, -1);
        } else {
          const buffer = new TextEncoder().encode(
            `Invalid return value: ${Deno.inspect(result)}`,
          );
          sqlite3_result_error(ctx, buffer, buffer.byteLength);
        }
      },
    );

    let flags = 1;

    if (options?.deterministic) {
      flags |= 0x000000800;
    }

    if (options?.directOnly) {
      flags |= 0x000080000;
    }

    if (options?.subtype) {
      flags |= 0x000100000;
    }

    if (options?.directOnly) {
      flags |= 0x000200000;
    }

    const err = sqlite3_create_function(
      this.#handle,
      toCString(name),
      options?.varargs ? -1 : options.step.length - 1,
      flags,
      null,
      null,
      cb.pointer,
      cbFinal.pointer,
    );

    unwrap(err, this.#handle);

    this.#callbacks.add(cb as Deno.UnsafeCallback);
    this.#callbacks.add(cbFinal as Deno.UnsafeCallback);
  }

  /**
   * Loads an SQLite extension library from the named file.
   */
  loadExtension(file: string, entryPoint?: string): void {
    if (!this.enableLoadExtension) {
      throw new Error("Extension loading is not enabled");
    }

    const pzErrMsg = new Uint32Array(2);

    const result = sqlite3_load_extension(
      this.#handle,
      toCString(file),
      entryPoint ? toCString(entryPoint) : null,
      pzErrMsg,
    );

    const pzErrPtr = Deno.UnsafePointer.create(
      pzErrMsg[0] + 2 ** 32 * pzErrMsg[1],
    );
    if (pzErrPtr !== null) {
      const pzErr = readCstr(pzErrPtr);
      sqlite3_free(pzErrPtr);
      throw new Error(pzErr);
    }

    unwrap(result, this.#handle);
  }

  /**
   * Closes the database connection.
   *
   * Calling this method more than once is no-op.
   */
  close(): void {
    if (!this.#open) return;
    for (const [stmt, db] of STATEMENTS) {
      if (db === this.#handle) {
        sqlite3_finalize(stmt);
        STATEMENTS.delete(stmt);
      }
    }
    for (const cb of this.#callbacks) {
      cb.close();
    }
    unwrap(sqlite3_close_v2(this.#handle));
    this.#open = false;
  }

  [Symbol.for("Deno.customInspect")](): string {
    return `SQLite3.Database { path: ${this.path} }`;
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
const wrapTransaction = <T extends (...args: any[]) => void>(
  fn: T,
  db: Database,
  { begin, commit, rollback, savepoint, release, rollbackTo }: any,
) =>
  function sqliteTransaction(...args: Parameters<T>): ReturnType<T> {
    const { apply } = Function.prototype;
    let before, after, undo;
    if (db.inTransaction) {
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
      // @ts-ignore An outer value of 'this' is shadowed by this container.
      const result = apply.call(fn, this, args);
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
