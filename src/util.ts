export function encode(str: string) {
  try {
    return (Deno as any).core.encode(str);
  } catch (_e) {
    return new TextEncoder().encode(str);
  }
}

export function cstr(str: string) {
  return new Uint8Array([...encode(str), 0]);
}
