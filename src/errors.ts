import { isSqlError, SqlError } from "@stdext/sql";

export class SqliteError extends SqlError {
  constructor(msg: string) {
    super(msg);
  }
}

export class SqliteTransactionError extends SqliteError {
  constructor(msg: string) {
    super(msg);
  }
}

/**
 * Check if an error is a SqliteError
 */
export function isSqliteError(err: unknown): err is SqliteError {
  return isSqlError(err) && err instanceof SqliteError;
}
