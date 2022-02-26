export function encode(str: string): Uint8Array {
  try {
    return (Deno as any).core.encode(str);
  } catch (_e) {
    return new TextEncoder().encode(str);
  }
}

export function toCString(str: string): Uint8Array {
  return new Uint8Array([...encode(str), 0]);
}

export function isObject(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}
