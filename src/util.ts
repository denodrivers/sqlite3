export const encoder = new TextEncoder();

export function toCString(str: string): Uint8Array {
  return encoder.encode(str + "\0");
}

export function isObject(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}
