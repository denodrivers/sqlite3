import native from "./native.ts";
import wasm from "./wasm.ts";
import { Backend } from "./backend.ts";

let level = 0;

function log(type: string, msg: string) {
  console.log(`${"  ".repeat(level)}%c${type} %c${msg}`, "color: #0DBC79", "");
}

const ROWS = 10;
const ITERS = 10;

const backends: Backend[] = [native, wasm];

backends.forEach((backend) => {
  log("Bench", backend.name);
  level++;

  backend.execute("pragma journal_mode = WAL", []);
  backend.execute("pragma synchronous = normal", []);
  backend.execute("pragma temp_store = memory", []);

  backend.execute(
    "create table test (key integer primary key autoincrement, value text not null)",
    [],
  );

  log("Insert", "Bench start ->");
  level++;

  let total = 0;
  let min!: number, max!: number;
  Array.from(
    { length: ITERS },
    (_, iter) => {
      const now = performance.now();
      const stmt = backend.prepare("insert into test (value) values (?)");
      Array.from(
        { length: ROWS },
        (_, i) => stmt.execute([`iter ${iter} loop ${i}`]),
      );
      stmt.finalize();
      const took = performance.now() - now;

      if (min === undefined || max === undefined) {
        min = max = took;
      } else {
        min = Math.min(min, took);
        max = Math.max(max, took);
      }

      total += took;
    },
  );

  log(
    "Result",
    `${ITERS} iter ${ROWS} rows took ${total.toFixed(2)}ms ${
      (ITERS / (total / 1000)).toFixed(2)
    } iter/sec min ${min.toFixed(2)}ms max ${max.toFixed(2)}ms ±${
      Math.abs(max - min).toFixed(2)
    }ms`,
  );
  level--;

  log("Query", "Bench start ->");
  level++;

  total = 0, min = undefined as any, max = undefined as any;
  Array.from({ length: ITERS }, () => {
    const now = performance.now();
    backend.query("select * from test");
    const took = performance.now() - now;

    if (min === undefined || max === undefined) {
      min = max = took;
    } else {
      min = Math.min(min, took);
      max = Math.max(max, took);
    }

    total += took;
  });

  log(
    "Result",
    `${ITERS} iter ${ROWS} rows took ${total.toFixed(2)}ms ${
      (ITERS / (total / 1000)).toFixed(2)
    } iter/sec min ${min.toFixed(2)}ms max ${max.toFixed(2)}ms ±${
      Math.abs(max - min).toFixed(2)
    }ms`,
  );

  level--;

  level--;

  backend.close();
});
