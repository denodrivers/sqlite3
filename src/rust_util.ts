import { decode, getPlatformFileName, u64ToF64 } from "./util.ts";

const file = `../${getPlatformFileName("util")}`;

const libutil = Deno.dlopen(new URL(file, import.meta.url), {
  read_ptr: {
    parameters: ["f64"],
    result: "u8",
  },
});

export function read_ptr(ptr: bigint) {
  return libutil.symbols.read_ptr(u64ToF64(ptr)) as number;
}

export function read_cstr(ptr: bigint) {
  let res = [], byte;
  while ((byte = read_ptr(ptr)) !== 0) {
    res.push(byte);
    ptr += 1n;
  }
  return decode(new Uint8Array(res));
}
