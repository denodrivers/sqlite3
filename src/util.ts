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
