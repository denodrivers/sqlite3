export const encoder = new TextEncoder();

export function toCString(str: string): Uint8Array {
  return encoder.encode(str + "\0");
}

export function isObject(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

const { op_ffi_cstr_read } = (Deno as any).core.ops;

export function unwrap(code: number): void {
  if (code !== 0) {
    throw new Error(`SQLite3 error: ${code}`);
  }
}

export { op_ffi_cstr_read as readCstr };
