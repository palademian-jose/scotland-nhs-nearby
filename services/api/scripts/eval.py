"""Score the golden set against /ask and write reports/eval.json.

Metrics (all on the committed sample database):
  intent_accuracy     in_scope, category, place and limit all match the label
  top1_hit_rate       first returned facility equals the independently computed nearest one
  refusal_accuracy    refused exactly when the question is out of scope
  grounded_rate       answered questions whose answer passes the citation/distance verifier
  unknown_place_safe  unknown places return no rows (the app must not guess a location)

Run: uv run python scripts/eval.py            (LLM_PROVIDER=fake is the default here)
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path

from fastapi.testclient import TestClient

from nhs_nearby.answer import verify_answer
from nhs_nearby.api import create_app
from nhs_nearby.geo import normalise_postcode
from nhs_nearby.models import NearbyResult
from nhs_nearby.settings import REPO_ROOT, Settings

GOLDEN = REPO_ROOT / "evals" / "golden" / "queries.jsonl"


def _norm_place(value: str | None) -> str | None:
    if value is None:
        return None
    return normalise_postcode(value) or value.strip().casefold()


def _commit() -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return out.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def run(out_dir: Path, golden: Path = GOLDEN) -> dict:
    os.environ.setdefault("LLM_PROVIDER", "fake")
    settings = Settings(
        use_sample=True,
        trace_path=out_dir / "eval-traces.jsonl",
        rate_limit_per_minute=100000,
        rate_limit_burst=100000,
        daily_cost_cap_usd=1000.0,
    )
    (out_dir / "eval-traces.jsonl").unlink(missing_ok=True)
    client = TestClient(create_app(settings))
    cases = [json.loads(x) for x in golden.read_text(encoding="utf-8").splitlines() if x.strip()]

    results: list[dict] = []
    for case in cases:
        exp = case["expected"]
        t0 = time.perf_counter()
        resp = client.post("/ask", json=case["input"])
        latency_ms = (time.perf_counter() - t0) * 1000
        body = resp.json()
        intent = body["intent"]
        refused = bool(body["refused"])
        if exp["in_scope"]:
            intent_ok = (
                intent["in_scope"]
                and intent["category"] == exp["category"]
                and _norm_place(intent["place"]) == _norm_place(exp["place"])
                and intent["limit"] == exp["limit"]
            )
        else:
            intent_ok = not intent["in_scope"]
        rows = [NearbyResult(**r) for r in body["results"]]
        top1 = None
        if exp["top1_id"]:
            top1 = bool(rows) and rows[0].id == exp["top1_id"]
        grounded = None
        if exp["in_scope"] and not refused and rows:
            grounded = verify_answer(body["answer"], rows)[0]
        unknown_safe = None
        if exp["in_scope"] and exp["top1_id"] is None:
            unknown_safe = not rows and not refused
        scores = {
            "intent": int(intent_ok),
            "refusal": int(refused == (not exp["in_scope"])),
        }
        if top1 is not None:
            scores["top1"] = int(top1)
        if grounded is not None:
            scores["grounded"] = int(grounded)
        if unknown_safe is not None:
            scores["unknown_place_safe"] = int(unknown_safe)
        results.append(
            {
                "id": case["id"],
                "scores": scores,
                "passed": all(v == 1 for v in scores.values()),
                "latency_ms": round(latency_ms, 2),
                "cost_usd": 0.0,
                "question": case["input"]["question"],
            }
        )

    def rate(key: str) -> float | None:
        vals = [r["scores"][key] for r in results if key in r["scores"]]
        return round(sum(vals) / len(vals), 4) if vals else None

    metrics = {
        "intent_accuracy": rate("intent"),
        "top1_hit_rate": rate("top1"),
        "refusal_accuracy": rate("refusal"),
        "grounded_rate": rate("grounded"),
        "unknown_place_safe": rate("unknown_place_safe"),
        "task_success": round(sum(r["passed"] for r in results) / len(results), 4),
    }
    report = {
        "run_id": datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ"),
        "commit": _commit(),
        "timestamp": datetime.now(UTC).isoformat(timespec="seconds"),
        "provider": "fake",
        "label": "fake-provider",
        "model": "fake-rules-v1",
        "n_cases": len(results),
        "metrics": metrics,
        "cases": results,
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "eval.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def gate(metrics: dict, config: Path) -> list[str]:
    """Return one message per metric that is below its configured minimum."""
    import yaml

    rules = yaml.safe_load(config.read_text(encoding="utf-8"))["metrics"]
    problems = []
    for name, rule in rules.items():
        value = metrics.get(name)
        if value is None or value < rule["min"]:
            problems.append(f"{name}: {value} < min {rule['min']}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "reports")
    parser.add_argument("--gate", type=Path, default=None, help="evals.yaml thresholds")
    args = parser.parse_args()
    report = run(args.out)
    print(json.dumps(report["metrics"], indent=2))
    for c in report["cases"]:
        if not c["passed"]:
            print("FAIL", c["id"], c["question"], c["scores"])
    if args.gate:
        problems = gate(report["metrics"], args.gate)
        for p in problems:
            print("GATE", p)
        return 1 if problems else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
