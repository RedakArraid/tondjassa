'use strict';

const durationBucketsMs = [25, 50, 100, 250, 500, 1000, 2500, 5000];
let inFlight = 0;
let total = 0;
let durationSumMs = 0;
const requests = new Map();
const buckets = new Map(durationBucketsMs.map((value) => [value, 0]));

function normalizedMethod(method) {
  const value = String(method || 'UNKNOWN').toUpperCase();
  return /^[A-Z]{1,12}$/.test(value) ? value : 'OTHER';
}

function statusClass(statusCode) {
  const status = Number(statusCode);
  return Number.isFinite(status) && status >= 100 && status <= 599
    ? `${Math.floor(status / 100)}xx`
    : 'unknown';
}

function begin(method) {
  const normalized = normalizedMethod(method);
  const started = process.hrtime.bigint();
  inFlight += 1;
  let finished = false;

  return (statusCode, knownDurationMs) => {
    if (finished) return;
    finished = true;
    inFlight = Math.max(0, inFlight - 1);

    const measured = Number(process.hrtime.bigint() - started) / 1e6;
    const durationMs = Number.isFinite(knownDurationMs) ? Number(knownDurationMs) : measured;
    total += 1;
    durationSumMs += Math.max(0, durationMs);

    const key = `${normalized}|${statusClass(statusCode)}`;
    requests.set(key, (requests.get(key) || 0) + 1);
    for (const limit of durationBucketsMs) {
      if (durationMs <= limit) buckets.set(limit, (buckets.get(limit) || 0) + 1);
    }
  };
}

function render() {
  const lines = [
    '# HELP mandemarket_http_requests_total HTTP requests grouped by method and status class.',
    '# TYPE mandemarket_http_requests_total counter',
  ];
  for (const [key, count] of [...requests.entries()].sort()) {
    const [method, klass] = key.split('|');
    lines.push(`mandemarket_http_requests_total{method="${method}",status_class="${klass}"} ${count}`);
  }

  lines.push(
    '# HELP mandemarket_http_request_duration_seconds HTTP request duration.',
    '# TYPE mandemarket_http_request_duration_seconds histogram',
  );
  for (const limit of durationBucketsMs) {
    lines.push(`mandemarket_http_request_duration_seconds_bucket{le="${limit / 1000}"} ${buckets.get(limit) || 0}`);
  }
  lines.push(`mandemarket_http_request_duration_seconds_bucket{le="+Inf"} ${total}`);
  lines.push(`mandemarket_http_request_duration_seconds_sum ${(durationSumMs / 1000).toFixed(6)}`);
  lines.push(`mandemarket_http_request_duration_seconds_count ${total}`);

  const memory = process.memoryUsage();
  lines.push(
    '# HELP mandemarket_http_requests_in_flight Requests currently being processed.',
    '# TYPE mandemarket_http_requests_in_flight gauge',
    `mandemarket_http_requests_in_flight ${inFlight}`,
    '# HELP mandemarket_process_uptime_seconds Node.js process uptime.',
    '# TYPE mandemarket_process_uptime_seconds gauge',
    `mandemarket_process_uptime_seconds ${process.uptime().toFixed(3)}`,
    '# HELP mandemarket_process_resident_memory_bytes Resident memory used by Node.js.',
    '# TYPE mandemarket_process_resident_memory_bytes gauge',
    `mandemarket_process_resident_memory_bytes ${memory.rss}`,
  );
  return lines.join('\n') + '\n';
}

function resetForTests() {
  inFlight = 0;
  total = 0;
  durationSumMs = 0;
  requests.clear();
  for (const limit of durationBucketsMs) buckets.set(limit, 0);
}

module.exports = { begin, render, resetForTests };
