const COMPILE_OPTIONS: Record<string, string> = {
  SQLITE_DQS: "0",
  SQLITE_DEFAULT_MEMSTATUS: "0",
  SQLITE_DEFAULT_WAL_SYNCHRONOUS: "1",
  SQLITE_OMIT_DEPRECATED: "1",
  SQLITE_OMIT_PROGRESS_CALLBACK: "1",
  SQLITE_OMIT_SHARED_CACHE: "1",
  SQLITE_OMIT_AUTOINIT: "1",
  SQLITE_LIKE_DOESNT_MATCH_BLOBS: "1",
  SQLITE_DEFAULT_CACHE_SIZE: "-16000",
  SQLITE_ENABLE_DESERIALIZE: "1",
  SQLITE_ENABLE_FTS3: "1",
  SQLITE_ENABLE_FTS3_PARENTHESIS: "1",
  SQLITE_ENABLE_FTS4: "1",
  SQLITE_ENABLE_FTS5: "1",
  SQLITE_ENABLE_GEOPOLY: "1",
  SQLITE_ENABLE_JSON1: "1",
  SQLITE_ENABLE_MATH_FUNCTIONS: "1",
  SQLITE_ENABLE_RTREE: "1",
  SQLITE_ENABLE_STAT4: "1",
  SQLITE_ENABLE_UPDATE_DELETE_LIMIT: "1",
  SQLITE_OMIT_TCL_VARIABLE: "1",
  SQLITE_OMIT_GET_TABLE: "1",
  SQLITE_SOUNDEX: "1",
  SQLITE_THREADSAFE: "2",
  SQLITE_TRACE_SIZE_LIMIT: "32",
  HAVE_INT16_T: "1",
  HAVE_INT32_T: "1",
  HAVE_INT64_T: "1",
  HAVE_UINT16_T: "1",
  HAVE_UINT32_T: "1",
  HAVE_UINT64_T: "1",
  SQLITE_ENABLE_COLUMN_METADATA: "1",
  SQLITE_DEFAULT_FOREIGN_KEYS: "1",
};

const prefix = Deno.build.os === "windows" ? "" : "lib";
const ext = Deno.build.os === "windows"
  ? "dll"
  : Deno.build.os === "darwin"
  ? "dylib"
  : "so";
const lib = `${prefix}sqlite3.${ext}`;
const libWithArch = `${prefix}sqlite3${
  Deno.build.arch !== "x86_64" ? `_${Deno.build.arch}` : ""
}.${ext}`;

const SLICE_WIN = Deno.build.os === "windows" ? 1 : 0;

const $ = (cmd: string | URL, ...args: string[]) => {
  console.log(`%c$ ${cmd.toString()} ${args.join(" ")}`, "color: #888");
  const c = typeof cmd === "string" ? cmd : cmd.pathname.slice(SLICE_WIN);
  new Deno.Command(c, {
    args,
    stdin: "null",
    stdout: "inherit",
    stderr: "inherit",
  }).outputSync();
};

await Deno.remove(new URL("../build", import.meta.url), { recursive: true })
  .catch(() => {});
await Deno.remove(new URL("../sqlite/build", import.meta.url), {
  recursive: true,
})
  .catch(() => {});
await Deno.mkdir(new URL("../build", import.meta.url));
await Deno.mkdir(new URL("../sqlite/build", import.meta.url));

if (Deno.build.os !== "windows") {
  COMPILE_OPTIONS["SQLITE_OS_UNIX"] = "1";
}

const CFLAGS = `CFLAGS=-g -O3 ${
  Object.entries(
    COMPILE_OPTIONS,
  )
    .map(([k, v]) => `-D${k}=${v}`)
    .join(" ")
}`;

if (Deno.build.os === "windows") {
  Deno.chdir(new URL("../build", import.meta.url));
  $(
    "nmake",
    "/f",
    "..\\sqlite\\Makefile.msc",
    "sqlite3.dll",
    "TOP=..\\sqlite",
    CFLAGS,
  );
  await Deno.copyFile(
    new URL(`../sqlite/build/${lib}`, import.meta.url),
    new URL(`../build/${libWithArch}`, import.meta.url),
  );
} else {
  Deno.chdir(new URL("../sqlite/build", import.meta.url));
  $(
    new URL("../sqlite/configure", import.meta.url),
    "--enable-releasemode",
  );
  $(
    "make",
    "-j",
    "8",
    CFLAGS,
  );
  await Deno.copyFile(
    new URL(`../sqlite/build/.libs/${lib}`, import.meta.url),
    new URL(`../build/${libWithArch}`, import.meta.url),
  );
}

console.log(`%c${libWithArch} built`, "color: #0f0");
