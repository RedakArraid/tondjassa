import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const API = process.env.LOAD_API_URL || 'http://127.0.0.1:4002';
const WEB = process.env.LOAD_WEB_URL || 'http://127.0.0.1:3000';
const total = Number(process.env.LOAD_REQUESTS || 60);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 12);
const maxP95Ms = Number(process.env.LOAD_MAX_P95_MS || 1500);
const output = process.env.LOAD_RESULT || 'qa-results/load-smoke.json';

if (!Number.isInteger(total) || total < 10 || total > 500) throw new Error('LOAD_REQUESTS must be an integer between 10 and 500');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50) throw new Error('LOAD_CONCURRENCY must be an integer between 1 and 50');

const targets = [
  { name: 'readiness', url: API + '/health/ready' },
  { name: 'products', url: API + '/api/products?limit=12' },
  { name: 'categories', url: API + '/api/categories' },
  { name: 'frontend', url: WEB + '/' },
];

const durations = [];
const statusCounts = {};
const failures = [];
let cursor = 0;

async function requestOne(index) {
  const target = targets[index % targets.length];
  const started = performance.now();
  try {
    const response = await fetch(target.url, {
      method: 'GET',
      headers: { 'User-Agent': 'MandeMarket-CI-Load-Smoke/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    const durationMs = performance.now() - started;
    durations.push(durationMs);
    const key = String(response.status);
    statusCounts[key] = (statusCounts[key] || 0) + 1;
    await response.arrayBuffer();
    if (!response.ok) failures.push({ index, target: target.name, status: response.status, durationMs });
  } catch (error) {
    const durationMs = performance.now() - started;
    durations.push(durationMs);
    failures.push({ index, target: target.name, error: error instanceof Error ? error.message : String(error), durationMs });
  }
}

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= total) return;
    await requestOne(index);
  }
}

await Promise.all(targets.map(async (target) => {
  const response = await fetch(target.url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Warmup failed for ' + target.name + ': HTTP ' + response.status);
  await response.arrayBuffer();
}));

const startedAt = new Date().toISOString();
const started = performance.now();
await Promise.all(Array.from({ length: concurrency }, () => worker()));
const elapsedMs = performance.now() - started;

const sorted = durations.slice().sort((a, b) => a - b);
const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))] || 0;
const report = {
  schema: 1,
  startedAt,
  finishedAt: new Date().toISOString(),
  requests: total,
  concurrency,
  elapsedMs: Math.round(elapsedMs),
  requestsPerSecond: Number((total / (elapsedMs / 1000)).toFixed(2)),
  latencyMs: {
    p50: Math.round(percentile(0.50)),
    p95: Math.round(percentile(0.95)),
    p99: Math.round(percentile(0.99)),
    max: Math.round(sorted.at(-1) || 0),
  },
  statusCounts,
  failures: failures.slice(0, 20),
  thresholds: { maxFailures: 0, maxP95Ms },
  success: failures.length === 0 && percentile(0.95) <= maxP95Ms,
  note: 'Bounded CI smoke test; not a production capacity benchmark.',
};

await fs.mkdir(output.split('/').slice(0, -1).join('/') || '.', { recursive: true });
await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

if (!report.success) process.exitCode = 1;
