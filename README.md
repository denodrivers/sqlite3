# deno_sqlite

[![Tags](https://img.shields.io/github/release/denodrivers/sqlite3)](https://github.com/denodrivers/sqlite3/releases)
[![Doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/sqlite3@0.5.0/mod.ts)
[![Checks](https://github.com/denodrivers/sqlite3/actions/workflows/ci.yml/badge.svg)](https://github.com/denodrivers/sqlite3/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/denodrivers/sqlite3)](https://github.com/denodrivers/sqlite3/blob/master/LICENSE)

Fastest & correct JavaScript bindings to SQLite3 C API, using Deno FFI.

# Example

```ts
import { Database } from "https://deno.land/x/sqlite3@0.5.0/mod.ts";

const db = new Database("test.db");

const [version] = db.prepare("select sqlite_version()").get<[string]>()!;
console.log(version);

db.close();
```

# Usage

Since this library depends on the unstable FFI API, you must pass `--allow-env`,
`--allow-ffi` and `--unstable` flags. Without it, the module will fail to find
and open SQLite3 native library.

```sh
deno run --allow-ffi --allow-env --unstable <file>
# or just
deno run -A --unstable <file>
```

# Benchmark

![image](https://user-images.githubusercontent.com/34997667/185867199-d6c38d20-4040-42d2-a39a-37c81dc1af24.png)

[Benchmark](./bench) based on
[just-js/02-sqlite](https://just-js.github.io/benchmarks/02-sqlite.html)

See [bench](./bench) for benchmarks source.

## Documentation

See [doc.md](./doc.md) for documentation.

Check out the API reference
[here](https://doc.deno.land/https://deno.land/x/sqlite3@0.5.0/mod.ts).

## Native Library

By default, this module will look for existing SQLite3 dynamic library on your
path, which is `sqlite3.dll` on Windows, `libsqlite3.so` on Linux, and
`libsqlite3.dylib` on macOS. If the library you want to use is not on path, then
you can use the `DENO_SQLITE_PATH` environment variable. You will have to
install SQLite3 separately if it's not already installed, since it is not
bundled with this module.

## Related

- [x/sqlite](https://deno.land/x/sqlite), WASM based.
- [async-sqlite3](https://github.com/denodrivers/async-sqlite3), asynchronous
  SQLite3 bindings using `rusqlite`.

## License

Check [LICENSE](./LICENSE) for details.

Copyright © 2022 DjDeveloperr
