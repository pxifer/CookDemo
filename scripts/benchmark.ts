import { writeFile, mkdir } from 'node:fs/promises';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { recipes } from '../shared/catalog';
import { recommend } from '../backend/src/recommendation';
import { mealWith, request, simpleRecipe } from '../tests/fixtures';
const timings: number[] = [], nodes: number[] = [];
for (let i = 0; i < 5; i++) await recommend(recipes, request());
const histogram = monitorEventLoopDelay({ resolution: 10 }); histogram.enable();
for (let i = 0; i < 50; i++) {
  const start = performance.now(); const r = await recommend(recipes, request());
  timings.push(performance.now() - start); nodes.push(r.nodes);
}
const m = mealWith('鸡蛋100个'); m.composition = 'custom'; m.counts = { meat: 0, veg: 6, soup: 0 };
const boundary = Array.from({ length: 100 }, (_, i) => simpleRecipe(`recipe-${i}`, [['egg', 1]]));
const controller = new AbortController(); const start = performance.now();
setTimeout(() => controller.abort(), 0);
const cancelled = await recommend(boundary, request(m), { signal: controller.signal, maxNodes: 20_000 });
const cancelMs = performance.now() - start;
histogram.disable(); timings.sort((a, b) => a - b);
const report = {
  measuredAt: new Date().toISOString(), runtime: process.version, platform: process.platform, sample: '17 constructed recipes / 34 variants; 50 warm in-process recommendations',
  warmP50Ms: Math.round(timings[24] * 100) / 100, warmP95Ms: Math.round(timings[47] * 100) / 100,
  maxSearchNodes: Math.max(...nodes), cancellationBoundary: { parents: 100, target: 6, status: cancelled.status, cancelMs: Math.round(cancelMs * 100) / 100, nodes: cancelled.nodes },
  eventLoopMaxMs: Math.round(histogram.max / 1e6 * 100) / 100,
  limitations: ['In-process synthetic data, not HTTP or cloud latency', 'No model calls, cold starts, concurrent load, or billing measurements', 'Not production SLO evidence'],
};
await mkdir(new URL('../artifacts/acceptance', import.meta.url), { recursive: true });
await writeFile(new URL('../artifacts/acceptance/benchmark.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
