# Documentation

## Opening Database

To open a new Database connection, construct the `Database` class with the path
to the database file. If the file does not exist, it will be created unless you
pass `create: false` in the options.

### Options

- `create: boolean` - Whether to create the database file if it does not exist.
  Defaults to `true`.
- `readonly: boolean` - Whether to open the database in read-only mode. Defaults
  to `false`.
- `memory: boolean` - Whether to open the database in memory. Defaults to
  `false`.
- `int64: boolean` - Whether to support BigInt columns. False by default, which
  means integers larger than 32 bit will be inaccurate.
- `flags: number` - Raw flags to pass to the C API. Normally you don't need
  this. Passing this ignores all other options.
- `unsafeConcurrency: boolean` - Enable optimizations that will affect
  syncronization with other clients. This can largerly improve performance for
  cases where you only have one client.
- `enableLoadExtension: boolean` - Enables the loading of SQLite extensions from
  a dynamic library, this needs to be set to true for the method `loadExtension`
  to work. Defaults to `false`.

### Usage

```ts
// Open using default options
const db = new Database("test.db");

// Open using URL path (relative to current file/module, not CWD)
const db = new Database(new URL("./test.db", import.meta.url));

// Open in memory
const db = new Database(":memory:");

// Open in read-only mode
const db = new Database("test.db", { readonly: true });

// Open existing database, error if it doesn't exist
const db = new Database("test.db", { create: false });
```

## Properties of `Database`

- `inTransaction: boolean` - Whether the database is currently in a transaction.
- `open: boolean` - Whether the database connection is open.
- `path: string` - The path to the database file (not full path, just the once
  passed to the constructor).
- `totalChanges: number` - The total number of changes made to the database
  since it was opened.
- `changes: number` - The number of changes made to the database by last
  executed statement.
- `lastInsertRowId: number` - The rowid of the last inserted row.
- `autocommit: boolean` - Whether the database is in autocommit mode. This is
  `true` when not in a transaction, and `false` when in a transaction.
- `enableLoadExtension: boolean` - Enables the loading of SQLite extensions from
  a dynamic library, this needs to be set to true for the method `loadExtension`
  to work. Defaults to `false`.

## Loading extensions

Loading SQLite3 extensions is enabled through the `enableLoadExtension` property
and config option. For security reasons it is disabled by default. If enabled it
is used with the `loadExtension` method on the database, it will attempt to load
the specified file as specified by the
[SQLite documentation](https://www.sqlite.org/c3ref/load_extension.html).
Optionally a second argument can be passed to the method specifying the
entrypoint name.

```ts
const db = new Database("test.db", { enableLoadExtension: true });

db.loadExtension("mod_spatialite");
```

It is also possible to load an extension directly from SQL using the
`load_extension` functions as specified by the
[SQLite documentation](https://www.sqlite.org/lang_corefunc.html#load_extension).

```ts
db.exec("SELECT load_extension('mod_spatialite')");
```

## Closing Database

To close the database connection, call the `close()` method. This will close the
database connection and free all resources associated with it. Calling it more
than once will be a no-op.

```ts
db.close();
```

## Executing SQL

To execute SQL statements, use the `exec()` method. This method will execute all
statements in the SQL string, and return the number of changes made by the last
statement. This method is useful for executing DDL statements, such as `CREATE`,
`DROP`, `ALTER`, and even pragma statements that do not return any data.

```ts
const changes = db.exec(
  "CREATE TABLE foo (bar TEXT); INSERT INTO foo VALUES ('baz');",
);

console.log(changes); // 1

// Executing pragma statements
db.exec("pragma journal_mode = WAL");
db.exec("pragma synchronous = normal");
db.exec("pragma temp_store = memory");
```

Any parameters past the first argument will be bound to the statement. When you
pass parameters, the function under the hood instead uses the prepared statement
API.

Note that when the prepared statement API is used, this method only supports one
statement at a time. You cannot execute multiple statements AND pass parameters
at the same time.

See [Binding Parameters](#binding-parameters) for more details.

Alternatively, use the `.sql` tagged template to safely execute SQL with given
parameters. It will execute the given SQL with parameters bounded and returns
all rows with `.all()`.

```ts
const minimum = 20;
const results = db.sql`
  SELECT
    id,
    name,
    age
  FROM students
  WHERE age > ${minimum}`;

console.log(results); // [ [ 2, "Brian", 30 ] ]
```

## Creating Prepared Statements

To prepare a statement, use the `prepare()` method. This method will return a
`Statement` object, which can be used to execute it, bind the parameters,
retrieve the results, and more.

```ts
const stmt = db.prepare("SELECT * FROM foo WHERE bar = ? AND baz = ?");

// or with a using statement

{
  using stmt = db.prepare("SELECT * FROM foo WHERE bar = ? AND baz = ?");
  // use stmt
}

// automatically disposed
```

For more details on binding parameters, see
[Binding Parameters](#binding-parameters).

## Properties of `Statement`

- `db: Database` - The database the statement belongs to.
- `expandedSql: string` - The SQL string with all bound parameters expanded.
- `sql: string` - The SQL string used to prepare the statement.
- `readonly: boolean` - Whether the statement is read-only.
- `bindParameterCount: number` - The number of parameters the statement expects.

## Executing Statement

To execute a statement, use the `run()` method. This method will execute the
statement, and return the number of changes made by the statement.

```ts
const changes = stmt.run(...params);
```

## Retrieving Rows

To retrieve rows from a statement, use the `all()` method. This method will
execute the statement, and return an array of rows as objects.

```ts
const rows = stmt.all(...params);
```

To get rows in array form, use `values()` method.

```ts
const rows = stmt.values(...params);
```

To get only the first row as object, use the `get()` method.

```ts
const row = stmt.get(...params);
```

To get only the first row as array, use the `value()` method.

```ts
const row = stmt.value(...params);
```

`all`/`values`/`get`/`value` methods also support a generic type parameter to
specify the type of the returned object.

```ts
interface Foo {
  bar: string;
  baz: number;
}

const rows = stmt.all<Foo>(...params);
// rows is Foo[]

const row = stmt.get<Foo>(...params);
// row is Foo | undefined

const values = stmt.values<[string, number]>(...params);
// values is [string, number][]

const row = stmt.value<[string, number]>(...params);
// row is [string, number] | undefined
```

## SQLite functions that return JSON

When using [SQLite's builtin JSON functions](https://www.sqlite.org/json1.html),
`sqlite3` will detect when a value has a "subtype" of JSON. If so, it will
attempt to `JSON.parse()` the text value and return the parsed JavaScript object
or array.

```ts
const [list] = db
  .prepare("SELECT json_array(1, 2, 3) as list")
  .value<[number[]]>()!;
// list = [ 1, 2, 3 ]

const [object] = db
  .prepare("SELECT json_object('name', 'Peter') as object")
  .value<[{ name: string }]>()!;

// object = { name: "Peter" }
```

Use the builtin [`json()`](https://www.sqlite.org/json1.html#jmini) SQL function
to convert your text values into JSON.

## Freeing Prepared Statements

Though the `Statement` object is automatically freed once it is no longer used,
that is it's caught by the garbage collector, you can also free it manually by
calling the `finalize()` method. Do not use the `Statement` object after calling
this method.

```ts
stmt.finalize();
```

You can also use `using` statement to automatically free the statement once the
scope ends.

```ts
{
  using stmt = db.prepare("SELECT * FROM foo WHERE bar = ? AND baz = ?");
  stmt.run("bar", "baz");
}

// stmt is automatically finalized here
```

## Setting fixed parameters

To set fixed parameters for a statement, use the `bind()` method. This method
will set the parameters for the statement, and return the statement itself.

It can only be called once and once it is called, changing the parameters is not
possible. It's merely an optimization to avoid having to bind the parameters
every time the statement is executed.

```ts
const stmt = db.prepare("SELECT * FROM foo WHERE bar = ? AND baz = ?");
stmt.bind("bar", "baz");
```

## Iterating over Statement

If you iterate over the statement object itself, it will iterate over the rows
step by step. This is useful when you don't want to load all the rows into
memory at once. Since it does not accept any parameters, you must bind the
parameters before iterating using `bind` method.

```ts
for (const row of stmt) {
  console.log(row);
}
```

## Transactions

To start a transaction, use the `transaction()` method. This method takes a
JavaScript function that will be called when the transaction is run. This method
itself returns a function that can be called to run the transaction.

When the transaction function is called, `BEGIN` is automatically called. When
the transaction function returns, `COMMIT` is automatically called. If the
transaction function throws an error, `ROLLBACK` is called.

If the transaction is called within another transaction, it will use
`SAVEPOINT`/`RELEASE`/`ROLLBACK TO` instead of `BEGIN`/`COMMIT`/`ROLLBACK` to
create a nested transaction.

The returned function also contains `deferred`/`immediate`/`exclusive`
properties (functions) which can be used to change `BEGIN` to
`BEGIN DEFERRED`/`BEGIN IMMEDIATE`/`BEGIN EXCLUSIVE`.

```ts
const stmt = db.prepare("INSERT INTO foo VALUES (?)");
const runTransaction = db.transaction((data: SomeData[]) => {
  for (const item of data) {
    stmt.run(item.value);
  }
});

runTransaction([
  { value: "bar" },
  { value: "baz" },
]);

// Run with BEGIN DEFERRED

runTransaction.deferred([
  { value: "bar" },
  { value: "baz" },
]);
```

## Binding Parameters

Parameters can be bound both by name and positiion. To bind by name, just pass
an object mapping the parameter name to the value. To bind by position, pass the
values as rest parameters.

SQLite supports `:`, `@` and `$` as prefix for named bind parameters. If you
don't have any in the Object's keys, the `:` prefix will be used by default.

Bind parameters can be passed to `Database#exec` after SQL parameter, or to
`Statement`'s `bind`/`all`/`values`/`run` function.

```ts
// Bind by name
db.exec("INSERT INTO foo VALUES (:bar)", { bar: "baz" });

// In prepared statements
const stmt = db.prepare("INSERT INTO foo VALUES (:bar)");
stmt.run({ bar: "baz" });

// Bind by position
db.exec("INSERT INTO foo VALUES (?)", "baz");

// In prepared statements
const stmt = db.prepare("INSERT INTO foo VALUES (?, ?)");
stmt.run("baz", "foo");
```

JavaScript to SQLite type mapping:

| JavaScript type         | SQLite type                 |
| ----------------------- | --------------------------- |
| `null`                  | `NULL`                      |
| `undefined`             | `NULL`                      |
| `number`                | `INTEGER`/`FLOAT`           |
| `bigint`                | `INTEGER`                   |
| `string`                | `TEXT`                      |
| `boolean`               | `INTEGER`                   |
| `Date`                  | `TEXT` (ISO)                |
| `Uint8Array`            | `BLOB`                      |
| JSON-serializable value | `TEXT` (`JSON.stringify()`) |

When retrieving rows, the types are mapped back to JavaScript types:

| SQLite type              | JavaScript type           |
| ------------------------ | ------------------------- |
| `NULL`                   | `null`                    |
| `INTEGER`                | `number`/`bigint`         |
| `FLOAT`                  | `number`                  |
| `TEXT`                   | `string`                  |
| `TEXT` with JSON subtype | `object` (`JSON.parse()`) |
| `BLOB`                   | `Uint8Array`              |

Note: We only support `Uint8Array` for the `BLOB` type as V8 Fast API will
optimize for it instead of other arrays like `Uint16Array`. And it is also to
stay consistent: we only support passing `Uint8Array` and we consistently return
`Uint8Array` when we return a `BLOB` to JS. It is easy to support passing all
typed arrays with good performance, but then at the time we have to retreive
again we don't know what the original typed array type was, as the only type
into in the column is that it is a `BLOB`.

You can easily convert between other typed arrays and `Uint8Array` like this:

```ts
const f32 = new Float32Array(1);
const u8 = new Uint8Array(f32.buffer); // no copy, can pass this

const u8FromSqlite = new Uint8Array(4);
const f32FromSqlite = new Float32Array(u8FromSqlite.buffer); // safely convert back when retrieved from sqlite, no copy
```
