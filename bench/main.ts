import native from "./native.ts";
import wasm from "./wasm.ts";
import { Backend } from "./backend.ts";

function log(type: string, msg: string) {
  console.log(`%c${type} %c${msg}`, "color: #0DBC79", "");
}

const ROWS = 100;
const ITERS = 10;

const backends: Backend[] = [native, wasm];

for (const backend of backends) {
  log("Bench", backend.name);

  backend.execute("pragma journal_mode = WAL", []);
  backend.execute("pragma synchronous = normal", []);
  backend.execute("pragma temp_store = memory", []);

  backend.execute(
    "create table test (key integer primary key autoincrement, value text not null)",
    [],
  );

  let total = 0;
  let min!: number, max!: number;
  for (let iter = 0; iter < ITERS; iter++) {
    const now = performance.now();
    const prep = backend.prepare("insert into test (value) values (?)");
    for (let i = 0; i < ROWS; i++) {
      prep.execute([`iter ${iter} loop ${i}`]);
    }
    prep.finalize();
    const took = performance.now() - now;

    if (min === undefined || max === undefined) {
      min = max = took;
    } else {
      min = Math.min(min, took);
      max = Math.max(max, took);
    }

    total += took;
  }
  backend.close();

  log(
    "Result",
    `${ITERS} iter ${ROWS} rows took ${total.toFixed(2)}ms ${
      (ITERS / (total / 1000)).toFixed(2)
    } iter/sec min ${min.toFixed(2)}ms max ${max.toFixed(2)}ms ±${
      Math.abs(max - min).toFixed(2)
    }ms`,
  );
}
