"""Latency of GET /nearby (in-process, through the ASGI stack) and of the bare SQL query.

Writes reports/bench.json. Uses the committed sample database; pass --full to also time the
built data/nhs.duckdb when it exists. Fixed seed, 100 warm-up calls, 1000 timed calls.
"""

from __future__ import annotations

import argparse
import json
import platform
import random
import statistics
import tempfile
import time
from pathlib import Path

from fastapi.testclient import TestClient

from nhs_nearby.api import create_app
from nhs_nearby.db import Database
from nhs_nearby.models import CATEGORIES
from nhs_nearby.settings import REPO_ROOT, Settings


def _pct(values: list[float], q: float) -> float:
    ordered = sorted(values)
    return round(ordered[min(len(ordered) - 1, int(q * len(ordered)))], 3)


def _points(n: int, seed: int = 7) -> list[tuple[float, float, str]]:
    rng = random.Random(seed)
    return [
        (rng.uniform(55.0, 58.8), rng.uniform(-6.0, -1.8), rng.choice(CATEGORIES)) for _ in range(n)
    ]


def bench(db: Database, label: str, n: int = 1000) -> dict:
    settings = Settings(
        llm_provider="fake",
        use_sample=True,
        rate_limit_per_minute=10**7,
        rate_limit_burst=10**7,
        trace_path=Path(tempfile.mkdtemp()) / "spans.jsonl",
    )
    client = TestClient(create_app(settings, db=db))
    pts = _points(n + 100)
    for lat, lon, cat in pts[:100]:
        client.get("/nearby", params={"lat": lat, "lon": lon, "category": cat, "limit": 10})
    http: list[float] = []
    sql: list[float] = []
    for lat, lon, cat in pts[100:]:
        t0 = time.perf_counter()
        r = client.get("/nearby", params={"lat": lat, "lon": lon, "category": cat, "limit": 10})
        http.append((time.perf_counter() - t0) * 1000)
        assert r.status_code == 200
        t0 = time.perf_counter()
        db.nearby(lat, lon, cat, 10)
        sql.append((time.perf_counter() - t0) * 1000)
    return {
        "database": label,
        "rows": sum(db.counts().values()),
        "calls": n,
        "http_p50_ms": _pct(http, 0.5),
        "http_p95_ms": _pct(http, 0.95),
        "sql_p50_ms": _pct(sql, 0.5),
        "sql_p95_ms": _pct(sql, 0.95),
        "http_mean_ms": round(statistics.fmean(http), 3),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "reports" / "bench.json")
    parser.add_argument("--full", action="store_true", help="also time data/nhs.duckdb")
    args = parser.parse_args()
    data = REPO_ROOT / "data"
    runs = [bench(Database.from_csv_dir(data / "sample"), "sample (committed CSVs, in memory)")]
    full = data / "nhs.duckdb"
    if args.full and full.exists():
        runs.append(bench(Database.open(Settings(data_dir=data)), "full (data/nhs.duckdb)"))
    report = {
        "machine": f"{platform.system()} {platform.machine()}, Python {platform.python_version()}",
        "note": "in-process ASGI test client; no network hop",
        "runs": runs,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
