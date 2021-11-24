export const LITTLE_ENDIAN =
  new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] === 0x78;

// Transmutation functions for handling BigInts in FFI
export function f64ToU64(f64: number) {
  const buffer = new ArrayBuffer(8);
  const dv = new DataView(buffer);
  dv.setFloat64(0, f64, LITTLE_ENDIAN);
  return dv.getBigUint64(0, LITTLE_ENDIAN);
}

export function u64ToF64(u64: bigint) {
  const buffer = new ArrayBuffer(8);
  const dv = new DataView(buffer);
  dv.setBigUint64(0, u64, LITTLE_ENDIAN);
  return dv.getFloat64(0, LITTLE_ENDIAN);
}

// Text Encoding / Decoding Utility
export function encode(str: string) {
  try {
    return (Deno as any).core.encode(str);
  } catch (_e) {
    return new TextEncoder().encode(str);
  }
}

export function decode(bytes: Uint8Array) {
  try {
    return (Deno as any).core.decode(bytes);
  } catch (_e) {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

// C String utility
export function cstr(str: string) {
  return new Uint8Array([...encode(str), 0]);
}

export const NULL_F64 = u64ToF64(0n);

export function getPlatformFileName(base: string) {
  let prefix = "lib", suffix = "dll";

  if (Deno.build.os === "windows") {
    prefix = "";
  } else if (Deno.build.os === "darwin") {
    suffix = "dylib";
  } else if (Deno.build.os === "linux") {
    suffix = "so";
  }

  return `${prefix}${base}.${suffix}`;
}
