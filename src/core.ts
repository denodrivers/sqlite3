import type {
  ArrayRow,
  Row,
  SqlClient,
  SqlConnectionOptions,
  SqlPreparable,
  SqlPreparedStatement,
  SqlQueriable,
  SqlQueryOptions,
  SqlTransaction,
  SqlTransactionable,
  SqlTransactionOptions,
} from "@stdext/sql";
import {
  type BindValue,
  Statement,
  type StatementOptions,
} from "./statement.ts";
import type { DatabaseOpenOptions } from "../mod.ts";
import {
  SqliteCloseEvent,
  SqliteConnectEvent,
  SqliteEventTarget,
} from "./events.ts";
import {
  SqliteConnectable,
  SqliteConnection,
  type SqliteConnectionOptions,
} from "./connection.ts";
import { SqliteTransactionError } from "./errors.ts";
import { mergeQueryOptions, transformToAsyncGenerator } from "./util.ts";

export type SqliteParameterType = BindValue;

export interface SqliteQueryOptions extends SqlQueryOptions, StatementOptions {
}

export interface SqliteTransactionOptions extends SqlTransactionOptions {
  beginTransactionOptions: {
    behavior?: "DEFERRED" | "IMMEDIATE" | "EXCLUSIVE";
  };
  commitTransactionOptions: undefined;
  rollbackTransactionOptions: {
    savepoint?: string;
  };
}

/** Various options that can be configured when opening Database connection. */
export interface SqliteClientOptions
  extends SqlConnectionOptions, DatabaseOpenOptions {
}

export class SqlitePreparedStatement extends SqliteConnectable
  implements
    SqlPreparedStatement<
      SqliteConnectionOptions,
      SqliteParameterType,
      SqliteQueryOptions,
      SqliteConnection
    > {
  readonly sql: string;
  declare readonly options: SqliteConnectionOptions & SqliteQueryOptions;
  readonly #statement: Statement;
  #deallocated = false;

  constructor(
    connection: SqlitePreparedStatement["connection"],
    sql: string,
    options: SqlitePreparedStatement["options"] = {},
  ) {
    super(connection, options);
    this.sql = sql;

    this.#statement = new Statement(
      this.connection.db.unsafeHandle,
      this.sql,
      this.options,
    );
  }
  get deallocated(): boolean {
    return this.#deallocated;
  }

  deallocate(): Promise<void> {
    this.#statement.finalize();
    this.#deallocated = true;
    return Promise.resolve();
  }

  execute(
    params?: SqliteParameterType[],
    _options?: SqliteQueryOptions | undefined,
  ): Promise<number | undefined> {
    return Promise.resolve(this.#statement.run(params));
  }
  query<T extends Row<BindValue> = Row<BindValue>>(
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions | undefined,
  ): Promise<T[]> {
    return Promise.resolve(this.#statement.all<T>(params, options));
  }
  queryOne<T extends Row<BindValue> = Row<BindValue>>(
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions | undefined,
  ): Promise<T | undefined> {
    return Promise.resolve(this.#statement.get<T>(params, options));
  }
  queryMany<T extends Row<BindValue> = Row<BindValue>>(
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions | undefined,
  ): AsyncGenerator<T> {
    return transformToAsyncGenerator(
      this.#statement.getMany<T>(params, options),
    );
  }
  queryArray<T extends ArrayRow<BindValue> = ArrayRow<BindValue>>(
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions | undefined,
  ): Promise<T[]> {
    return Promise.resolve(this.#statement.values<T>(params, options));
  }
  queryOneArray<T extends ArrayRow<BindValue> = ArrayRow<BindValue>>(
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions | undefined,
  ): Promise<T | undefined> {
    return Promise.resolve(this.#statement.value<T>(params, options));
  }
  queryManyArray<T extends ArrayRow<BindValue> = ArrayRow<BindValue>>(
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions | undefined,
  ): AsyncGenerator<T> {
    return transformToAsyncGenerator(
      this.#statement.valueMany<T>(params, options),
    );
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.deallocate();
    await super[Symbol.asyncDispose]();
  }
}

/**
 * Represents a base queriable class for SQLite3.
 */
export class SqliteQueriable extends SqliteConnectable implements
  SqlQueriable<
    SqliteConnectionOptions,
    SqliteParameterType,
    SqliteQueryOptions,
    SqliteConnection
  > {
  declare readonly options: SqliteConnectionOptions & SqliteQueryOptions;

  constructor(
    connection: SqliteQueriable["connection"],
    options: SqliteQueriable["options"] = {},
  ) {
    super(connection, options);
  }
  prepare(sql: string, options?: SqliteQueryOptions): SqlitePreparedStatement {
    return new SqlitePreparedStatement(
      this.connection,
      sql,
      mergeQueryOptions(this.options, options),
    );
  }

  execute(
    sql: string,
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions | undefined,
  ): Promise<number | undefined> {
    return this.prepare(sql, options).execute(params);
  }
  query<T extends Row<BindValue> = Row<BindValue>>(
    sql: string,
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions | undefined,
  ): Promise<T[]> {
    return this.prepare(sql, options).query<T>(params);
  }
  queryOne<T extends Row<BindValue> = Row<BindValue>>(
    sql: string,
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions | undefined,
  ): Promise<T | undefined> {
    return this.prepare(sql, options).queryOne<T>(params);
  }
  queryMany<T extends Row<BindValue> = Row<BindValue>>(
    sql: string,
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions | undefined,
  ): AsyncGenerator<T> {
    return this.prepare(sql, options).queryMany<T>(params);
  }
  queryArray<T extends ArrayRow<BindValue> = ArrayRow<BindValue>>(
    sql: string,
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions | undefined,
  ): Promise<T[]> {
    return this.prepare(sql, options).queryArray<T>(params);
  }
  queryOneArray<T extends ArrayRow<BindValue> = ArrayRow<BindValue>>(
    sql: string,
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions | undefined,
  ): Promise<T | undefined> {
    return this.prepare(sql, options).queryOneArray<T>(params);
  }
  queryManyArray<T extends ArrayRow<BindValue> = ArrayRow<BindValue>>(
    sql: string,
    params?: SqliteParameterType[],
    options?: SqliteQueryOptions | undefined,
  ): AsyncGenerator<T> {
    return this.connection.queryManyArray<T>(sql, params, options);
  }

  sql<T extends Row<BindValue> = Row<BindValue>>(
    strings: TemplateStringsArray,
    ...parameters: BindValue[]
  ): Promise<T[]> {
    const sql = strings.join("?");
    return this.query<T>(sql, parameters);
  }

  sqlArray<T extends ArrayRow<BindValue> = ArrayRow<BindValue>>(
    strings: TemplateStringsArray,
    ...parameters: BindValue[]
  ): Promise<T[]> {
    const sql = strings.join("?");
    return this.queryArray<T>(sql, parameters);
  }
}

export class SqlitePreparable extends SqliteQueriable implements
  SqlPreparable<
    SqliteConnectionOptions,
    SqliteParameterType,
    SqliteQueryOptions,
    SqliteConnection,
    SqlitePreparedStatement
  > {
}

export class SqliteTransaction extends SqliteQueriable
  implements
    SqlTransaction<
      SqliteConnectionOptions,
      SqliteParameterType,
      SqliteQueryOptions,
      SqliteConnection,
      SqlitePreparedStatement,
      SqliteTransactionOptions
    > {
  #inTransaction: boolean = true;
  get inTransaction(): boolean {
    return this.connected && this.#inTransaction;
  }

  get connected(): boolean {
    if (!this.#inTransaction) {
      throw new SqliteTransactionError(
        "Transaction is not active, create a new one using beginTransaction",
      );
    }

    return super.connected;
  }

  async commitTransaction(
    _options?: SqliteTransactionOptions["commitTransactionOptions"],
  ): Promise<void> {
    try {
      await this.execute("COMMIT");
    } catch (e) {
      this.#inTransaction = false;
      throw e;
    }
  }
  async rollbackTransaction(
    options?: SqliteTransactionOptions["rollbackTransactionOptions"],
  ): Promise<void> {
    try {
      if (options?.savepoint) {
        await this.execute("ROLLBACK TO ?", [options.savepoint]);
      } else {
        await this.execute("ROLLBACK");
      }
    } catch (e) {
      this.#inTransaction = false;
      throw e;
    }
  }
  async createSavepoint(name: string = `\t_bs3.\t`): Promise<void> {
    await this.execute(`SAVEPOINT ${name}`);
  }
  async releaseSavepoint(name: string = `\t_bs3.\t`): Promise<void> {
    await this.execute(`RELEASE ${name}`);
  }
}

/**
 * Represents a queriable class that can be used to run transactions.
 */
export class SqliteTransactionable extends SqlitePreparable
  implements
    SqlTransactionable<
      SqliteConnectionOptions,
      SqliteParameterType,
      SqliteQueryOptions,
      SqliteConnection,
      SqlitePreparedStatement,
      SqliteTransactionOptions,
      SqliteTransaction
    > {
  async beginTransaction(
    options?: SqliteTransactionOptions["beginTransactionOptions"],
  ): Promise<SqliteTransaction> {
    let sql = "BEGIN";
    if (options?.behavior) {
      sql += ` ${options.behavior}`;
    }
    await this.execute(sql);

    return new SqliteTransaction(this.connection, this.options);
  }

  async transaction<T>(
    fn: (t: SqliteTransaction) => Promise<T>,
    options?: SqliteTransactionOptions,
  ): Promise<T> {
    const transaction = await this.beginTransaction(
      options?.beginTransactionOptions,
    );

    try {
      const result = await fn(transaction);
      await transaction.commitTransaction(options?.commitTransactionOptions);
      return result;
    } catch (error) {
      await transaction.rollbackTransaction(
        options?.rollbackTransactionOptions,
      );
      throw error;
    }
  }
}

/**
 * Sqlite client
 */
export class SqliteClient extends SqliteTransactionable implements
  SqlClient<
    SqliteEventTarget,
    SqliteConnectionOptions,
    SqliteParameterType,
    SqliteQueryOptions,
    SqliteConnection,
    SqlitePreparedStatement,
    SqliteTransactionOptions,
    SqliteTransaction
  > {
  readonly eventTarget: SqliteEventTarget;

  constructor(
    connectionUrl: string | URL,
    options: SqliteClientOptions = {},
  ) {
    const conn = new SqliteConnection(connectionUrl, options);
    super(conn, options);
    this.eventTarget = new SqliteEventTarget();
  }

  async connect(): Promise<void> {
    await this.connection.connect();
    this.eventTarget.dispatchEvent(
      new SqliteConnectEvent({ connection: this.connection }),
    );
  }
  async close(): Promise<void> {
    this.eventTarget.dispatchEvent(
      new SqliteCloseEvent({ connection: this.connection }),
    );
    await this.connection.close();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }
}
