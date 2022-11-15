import { createCanvas } from "https://deno.land/x/skia_canvas@0.3.1/mod.ts";
import "https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js";
import "https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0/dist/chartjs-plugin-datalabels.min.js";

Chart.register(ChartDataLabels);

function $(name) {
  const lines = new TextDecoder().decode(
    Deno.spawnSync(Deno.execPath(), {
      args: ["task", name],
      env: {
        NO_COLOR: "1",
      },
      stdout: "piped",
    }).stdout,
  )
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes(" rate "));
  const all = lines.map((e) => Number(e.split(" rate ")[1]));
  return all.reduce((p, a) => p + a, 0) / all.length;
}

console.log("Running C benchmark...");
const cOut = $("bench-c");
console.log("C Avg:", cOut);

console.log("Running Deno benchmark...");
const denoOut = $("bench-deno");
console.log("Deno Avg:", denoOut);

console.log("Running Deno Wasm benchmark...");
const denoWasmOut = $("bench-deno-wasm");
console.log("Deno Wasm Avg:", denoWasmOut);

console.log("Running Deno FFI benchmark...");
const denoFfiOut = $("bench-deno-ffi");
console.log("Deno FFI Avg:", denoFfiOut);

console.log("Running Node benchmark...");
const nodeOut = $("bench-node");
console.log("Node Avg:", nodeOut);

console.log("Running Bun benchmark...");
const bunOut = $("bench-bun");
console.log("Bun Avg:", bunOut);

console.log("Running Bun FFI benchmark...");
const bunFfiOut = $("bench-bun-ffi");
console.log("Bun FFI Avg:", bunFfiOut);

console.log("Running Python benchmark...");
const pyOut = $("bench-python");
console.log("Python Avg:", pyOut);

const data = {
  labels: [
    "C",
    "Deno FFI",
    "x/sqlite3 (FFI)",
    "x/sqlite (WASM)",
    "better-sqlite3",
    "bun:ffi",
    "bun:sqlite",
    "python sqlite",
  ],
  datasets: [{
    label: "Performance",
    data: [
      cOut,
      denoFfiOut,
      denoOut,
      denoWasmOut,
      nodeOut,
      bunFfiOut,
      bunOut,
      pyOut,
    ],
    backgroundColor: [
      "#8dc149",
      "#4285f4",
      "#ea4336",
      "#fbbb07",
      "#34a753",
      "#ff6d01",
      "#5d5986",
      "#417996",
    ],
    borderWidth: 0,
    borderRadius: 6,
  }],
};

const canvas = createCanvas(800, 600);
const ctx = canvas.getContext("2d");

console.log("Rendering chart...");

const _chart = new Chart(ctx, {
  type: "bar",
  data,
  options: {
    plugins: {
      title: {
        display: true,
        text: `SQLite Benchmark`,
      },
      subtitle: {
        display: true,
        text: `Higher is better`,
      },
      datalabels: {
        anchor: "end",
        align: "top",
        formatter: Math.round,
        font: {
          weight: "normal",
          size: 14,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "ops/sec",
        },
      },
      x: {
        title: {
          display: true,
          text: "module",
        },
      },
    },
    responsive: false,
    animation: false,
  },
  plugins: [
    {
      id: "custom_canvas_background_color",
      beforeDraw: (chart) => {
        const { ctx } = chart;
        ctx.save();
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
      },
    },
  ],
});

canvas.save("bench/results.png");
console.log("Done!");
