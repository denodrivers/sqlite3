export interface Prepare {
  execute(params: unknown[]): void;
  finalize(): void;
}

export interface Backend {
  name: string;
  execute(sql: string, params: unknown[]): void;
  prepare(sql: string): Prepare;
  close(): void;
}
