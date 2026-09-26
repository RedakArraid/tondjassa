"""Small isolated HTTP concurrency smoke.

This is not a capacity benchmark and deliberately has no latency SLA. It catches
obvious 5xx/connection failures under modest parallel reads against the actual
production images used by browser acceptance.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import ssl
import statistics
import time
import urllib.request

OUT = Path("qa-results")
OUT.mkdir(exist_ok=True)
CERT_DIR = os.environ.get("QA_CERTS_DIR")
if not CERT_DIR:
    raise RuntimeError("QA_CERTS_DIR is required")

TLS = ssl.create_default_context(cafile=str(Path(CERT_DIR) / "cert.pem"))
TARGETS = [
    ("frontend", "https://localhost:3443/"),
    ("catalog", "https://localhost:3443/api/products?limit=10"),
    ("readiness", "http://127.0.0.1:4002/health/ready"),
]
REQUESTS_PER_TARGET = 30
WORKERS = 12


def request(target):
    name, url = target
    started = time.perf_counter()
    context = TLS if url.startswith("https://") else None
    try:
        with urllib.request.urlopen(url, timeout=10, context=context) as response:
            response.read(1024)
            status = response.status
        error = None if 200 <= status < 400 else f"HTTP {status}"
    except Exception as exc:
        status = None
        error = f"{type(exc).__name__}: {exc}"
    return {
        "target": name,
        "status": status,
        "duration_ms": round((time.perf_counter() - started) * 1000, 2),
        "error": error,
    }


work = [target for target in TARGETS for _ in range(REQUESTS_PER_TARGET)]
with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
    results = list(pool.map(request, work))

failures = [result for result in results if result["error"]]
summary = {}
for name, _ in TARGETS:
    durations = sorted(result["duration_ms"] for result in results if result["target"] == name and not result["error"])
    if not durations:
        summary[name] = {"success": 0, "p50_ms": None, "p95_ms": None, "max_ms": None}
        continue
    p95_index = min(len(durations) - 1, max(0, int(len(durations) * 0.95) - 1))
    summary[name] = {
        "success": len(durations),
        "p50_ms": round(statistics.median(durations), 2),
        "p95_ms": durations[p95_index],
        "max_ms": max(durations),
    }

report = {
    "scope": "isolated modest-concurrency HTTP read smoke; not a production capacity benchmark",
    "requests": len(results),
    "workers": WORKERS,
    "failures": len(failures),
    "targets": summary,
}
(OUT / "http-concurrency.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
if failures:
    print(json.dumps(failures[:10], indent=2))
    raise SystemExit(1)
