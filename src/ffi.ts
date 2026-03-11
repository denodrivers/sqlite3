import meta from "../deno.json" with { type: "json" };
import { dlopen } from "../deps.ts";
import { symbols } from "./symbols.ts";

let lib: Deno.DynamicLibrary<typeof symbols>["symbols"];

function tryGetEnv(key: string): string | undefined {
  try {
    return Deno.env.get(key);
  } catch (e) {
    if (e instanceof Deno.errors.PermissionDenied) {
      return undefined;
    }
    throw e;
  }
}

try {
  const customPath = tryGetEnv("DENO_SQLITE_PATH");
  const sqliteLocal = tryGetEnv("DENO_SQLITE_LOCAL");

  if (sqliteLocal === "1") {
    lib = Deno.dlopen(
      new URL(
        `../build/${Deno.build.os === "windows" ? "" : "lib"}sqlite3${
          Deno.build.arch !== "x86_64" ? `_${Deno.build.arch}` : ""
        }.${
          Deno.build.os === "windows"
            ? "dll"
            : Deno.build.os === "darwin"
            ? "dylib"
            : "so"
        }`,
        import.meta.url,
      ),
      symbols,
    ).symbols;
  } else if (customPath) {
    lib = Deno.dlopen(customPath, symbols).symbols;
  } else {
    lib = (
      await dlopen(
        {
          name: "sqlite3",
          url: `${meta.github}/releases/download/${meta.version}/`,
          suffixes: {
            aarch64: "_aarch64",
          },
        },
        symbols,
      )
    ).symbols;
  }
} catch (e) {
  if (e instanceof Deno.errors.PermissionDenied) {
    throw e;
  }

  throw new Error("Failed to load SQLite3 Dynamic Library", { cause: e });
}

const init = lib.sqlite3_initialize();
if (init !== 0) {
  throw new Error(`Failed to initialize SQLite3: ${init}`);
}

export default lib;
