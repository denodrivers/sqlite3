import native from "./native.ts";
import wasm from "./wasm.ts";
import { Backend } from "./backend.ts";

const ROWS = 10;

const backends: Backend[] = [native, wasm];

for (const backend of backends) {
  backend.execute("pragma journal_mode = WAL", []);
  backend.execute("pragma synchronous = normal", []);
  backend.execute("pragma temp_store = memory", []);

  backend.execute(
    "create table test (key integer primary key autoincrement, value text not null)",
    [],
  );

  Deno.bench(`${backend.name}: insert`, () => {
    const prep = backend.prepare("insert into test (value) values (?)");
    for (let i = 0; i < ROWS; i++) {
      prep.execute([`loop ${i}`]);
    }
    prep.finalize();
  });

  Deno.bench(`${backend.name}: query`, () => {
    backend.query("select * from test");
  });

  globalThis.addEventListener("unload", () => {
    backend.close();
  });
}
