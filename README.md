# deno_sqlite

[![Tags](https://img.shields.io/github/release/denodrivers/sqlite3)](https://github.com/denodrivers/sqlite3/releases)
[![Doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/sqlite3@0.3.1/mod.ts)
[![Checks](https://github.com/denodrivers/sqlite3/actions/workflows/ci.yml/badge.svg)](https://github.com/denodrivers/sqlite3/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/denodrivers/sqlite3)](https://github.com/denodrivers/sqlite3/blob/master/LICENSE)

Fast, native bindings to SQLite3 C API, using Deno FFI.

```ts
import { Database } from "https://deno.land/x/sqlite3@0.3.1/mod.ts";

const db = new Database("test.db");

const [version] = db.queryArray("select sqlite_version()")[0];
console.log(version);

db.close();
```

## Documentation

Check out the documentation
[here](https://doc.deno.land/https://deno.land/x/sqlite3@0.3.1/mod.ts).

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
