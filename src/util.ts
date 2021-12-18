export const LITTLE_ENDIAN =
  new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] === 0x78;

// Text Encoding / Decoding Utility
export function encode(str: string) {
  try {
    return (Deno as any).core.encode(str);
  } catch (_e) {
    return new TextEncoder().encode(str);
  }
}

// C String utility
export function cstr(str: string) {
  return new Uint8Array([...encode(str), 0]);
}
