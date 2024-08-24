# Deno SQLite3

[![Tags](https://img.shields.io/github/release/denodrivers/sqlite3)](https://github.com/denodrivers/sqlite3/releases)
[![Doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/sqlite3@0.11.1/mod.ts)
[![Checks](https://github.com/denodrivers/sqlite3/actions/workflows/ci.yml/badge.svg)](https://github.com/denodrivers/sqlite3/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/denodrivers/sqlite3)](https://github.com/denodrivers/sqlite3/blob/master/LICENSE)
[![Sponsor](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86)](https://github.com/sponsors/DjDeveloperr)

The fastest and correct module for SQLite3 in Deno.

## Example

```ts
import { Database } from "jsr:@db/sqlite@0.11";

const db = new Database("test.db");

const [version] = db.prepare("select sqlite_version()").value<[string]>()!;
console.log(version);

db.close();
```

Using [stdext/sql](https://jsr.io/@stdext/sql) interfaces:

```ts
import { SqliteClient } from "jsr:@db/sqlite@0.11/std_sql";

await using db = new SqliteClient("test.db");

const [version] = await db.queryArray("select sqlite_version()");
console.log(version);
```

## Usage

### Permissions

Since this library depends on the unstable FFI API, you must pass `--allow-env`,
`--allow-ffi` and `--unstable-ffi` flags. Network and FS permissions are also
needed to download and cache prebuilt library.

You can also just use `--allow-all` / `-A` flag since FFI basically gives full
access.

```sh
deno run -A --unstable-ffi <file>
```

### std/sql

In addition to the existing `Database` class, a new entrypoint is also exported
to provide compatibility with the [stdext/sql](https://jsr.io/@stdext/sql)
interfaces. Due to the specs, this relies on promises.

```ts
import { SqliteClient } from "jsr:@db/sqlite@0.11/std_sql";

await using db = new SqliteClient("test.db");

await db.execute("create table people (name TEXT)"); // 0
await db.execute("insert into people (name) values ('Alex'), ('Luca');"); // 2
await db.query("select * from people"); // [{name:"Alex"}, {name:"Luca"}]
await db.queryOne("select * from people"); // {name:"Alex"}
Array.fromAsync(db.queryMany("select * from people")); // [{name:"Alex"}, {name:"Luca"}]
await db.queryArray("select * from people"); // [["Alex"], ["Luca"]]
await db.queryOneArray("select * from people"); // ["Alex"]
Array.fromAsync(db.queryManyArray("select * from people")); // [["Alex"], ["Luca"]]
await db.sql`select * from people`; // [{name:"Alex"}, {name:"Luca"}]
await db.sqlArray`select * from people`; // [["Alex"], ["Luca"]]
```

> In general, the `SqliteClient` is good for most cases, and conforms to the
> generalized interfaces in the standard library. However if you are facing
> speed bottlenecks, the `Database` from the main export whould give you some
> more performance.

For more documentation regarding the standard interface, read the
[docs](https://jsr.io/@stdext/sql)

## Benchmark

![image](./bench/results.png)

[Benchmark](./bench) based on
[just-js/02-sqlite](https://just-js.github.io/benchmarks/02-sqlite.html)

See [bench](./bench) for benchmarks source.

## Documentation

See [doc.md](https://github.com/denodrivers/sqlite3/blob/main/doc.md) for
documentation.

Check out the complete API reference
[here](https://doc.deno.land/https://deno.land/x/sqlite3@0.11.1/mod.ts).

## Native Library

It will download and cache a prebuilt shared library from GitHub releases, for
which it will need network and file system read/write permission.

If you want to use custom library, then you can set the `DENO_SQLITE_PATH`
environment variable, to a fully specified path to the SQLite3 shared library.

## Contributing

Code is formatted using `deno fmt` and linted using `deno lint`. Please make
sure to run these commands before committing.

You can optionally build sqlite3 from source. Make sure that you have the
submodule (`git submodule update --init --recursive`).

```sh
deno task build
```

When running tests and benchmarks, you use the `DENO_SQLITE_LOCAL=1` env
variable otherwise it won't use to locally compiled SQLite library.

```sh
DENO_SQLITE_LOCAL=1 deno task bench
```

## Related

- [x/sqlite](https://deno.land/x/sqlite), WASM based.

## License

Apache-2.0. Check [LICENSE](./LICENSE) for details.

Copyright © 2023 DjDeveloperr
