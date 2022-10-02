# deno_sqlite

[![Tags](https://img.shields.io/github/release/denodrivers/sqlite3)](https://github.com/denodrivers/sqlite3/releases)
[![Doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/sqlite3@0.6.1/mod.ts)
[![Checks](https://github.com/denodrivers/sqlite3/actions/workflows/ci.yml/badge.svg)](https://github.com/denodrivers/sqlite3/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/denodrivers/sqlite3)](https://github.com/denodrivers/sqlite3/blob/master/LICENSE)
[![Sponsor](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86)](https://github.com/sponsors/DjDeveloperr)

Fastest & correct JavaScript bindings to SQLite3 C API, using Deno FFI.

## Example

```ts
import { Database } from "https://deno.land/x/sqlite3@0.6.1/mod.ts";

const db = new Database("test.db");

const [version] = db.prepare("select sqlite_version()").value<[string]>()!;
console.log(version);

db.close();
```

## Usage

Since this library depends on the unstable FFI API, you must pass `--allow-env`,
`--allow-ffi` and `--unstable` flags. Network and FS permissions are also needed
on macOS and Linux to download and cache prebuilt library. It's recommended to
just use `--allow-all`/`-A` flag since FFI basically gives full access.

```sh
deno run -A --unstable <file>
```

## Benchmark

![image](https://user-images.githubusercontent.com/34997667/189836272-16a0d876-979f-4ccc-8380-571faf54acf7.png)

[Benchmark](./bench) based on
[just-js/02-sqlite](https://just-js.github.io/benchmarks/02-sqlite.html)

See [bench](./bench) for benchmarks source.

## Documentation

See [doc.md](https://github.com/denodrivers/sqlite3/blob/main/doc.md) for
documentation.

Check out the complete API reference
[here](https://doc.deno.land/https://deno.land/x/sqlite3@0.6.1/mod.ts).

## Native Library

On Linux and macOS, it will download and cache a prebuilt shared library from
GitHub releases. For which it will also need net and read/write permission.

On Winows, it will look for existing SQLite3 dynamic library on your path, which
is `sqlite3.dll`. You _might_ have to install SQLite3 library separately if it's
not already installed, since it is not bundled with this module.

If the library you want to use is not on path, then you can set the
`DENO_SQLITE_PATH` environment variable, containing full path to the SQLite3
shared library.

## Contributing

Code is formatted using `deno fmt` and linted using `deno lint`. Please make
sure to run these commands before committing.

On Linux and macOS, you need to build sqlite3 from source. Make sure that you
have the submodule (`git submodule update --init --recursive`).

```sh
mkdir -p build/
make
```

When running tests and benchmarks, you need to use the `DENO_SQLITE_PATH` env
variable otherwise it won't use to local compiled shared library.

```sh
DENO_SQLITE_PATH=build/libsqlite3.dylib deno task bench
```

## Related

- [x/sqlite](https://deno.land/x/sqlite), WASM based.
- [async-sqlite3](https://github.com/denodrivers/async-sqlite3), asynchronous
  SQLite3 bindings using `rusqlite`.

## License

Apache-2.0. Check [LICENSE](./LICENSE) for details.

Copyright © 2022 DjDeveloperr
