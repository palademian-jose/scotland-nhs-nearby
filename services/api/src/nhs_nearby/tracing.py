"""Local span writer for the shared trace schema (one JSON object per line).

Fields: trace_id, span_id, parent_span_id, name, kind, start_ts, end_ts, latency_ms, model,
input_tokens, output_tokens, cost_usd, cache_hit, feature, user_id, session_id, status,
error_kind, meta. Compatible with the llmops trace explorer.
"""

from __future__ import annotations

import json
import threading
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

FEATURE = "nearby.ask"
_PRICING_FILE = Path(__file__).with_name("pricing.json")


@lru_cache
def _load_pricing(path: str | None) -> dict[str, dict[str, float]]:
    p = Path(path) if path else _PRICING_FILE
    return {k: v for k, v in json.loads(p.read_text(encoding="utf-8")).items() if k[0] != "_"}


def price_cost(
    model: str, input_tokens: int, output_tokens: int, pricing_path: Path | None = None
) -> float:
    """Tokens x list price. Unknown models cost 0 (and are flagged by the caller's meta)."""
    table = _load_pricing(str(pricing_path) if pricing_path else None)
    entry = table.get(model) or table.get(model.split("/", 1)[-1])
    if not entry:
        return 0.0
    return (input_tokens * entry["input_per_m"] + output_tokens * entry["output_per_m"]) / 1e6


def _ts(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, UTC).strftime("%Y-%m-%dT%H:%M:%S.") + (
        f"{int((epoch % 1) * 1000):03d}Z"
    )


class Tracer:
    """Appends spans to a JSONL file; a tracer built with ``path=None`` discards them."""

    def __init__(self, path: Path | None, feature: str = FEATURE) -> None:
        self.path = path
        self.feature = feature
        self._lock = threading.Lock()
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)

    def new_trace(self) -> str:
        return str(uuid.uuid4())

    def emit(self, record: dict[str, Any]) -> None:
        if not self.path:
            return
        line = json.dumps(record, separators=(",", ":"))
        with self._lock, self.path.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")

    @contextmanager
    def span(
        self,
        name: str,
        *,
        kind: str = "other",
        trace_id: str,
        parent: str | None = None,
        user_id: str = "anon",
        model: str | None = None,
    ) -> Iterator[dict[str, Any]]:
        """Yield a mutable record; set tokens, cost_usd and meta inside the block."""
        span_id = str(uuid.uuid4())
        rec: dict[str, Any] = {
            "trace_id": trace_id,
            "span_id": span_id,
            "parent_span_id": parent,
            "name": name,
            "kind": kind,
            "model": model,
            "input_tokens": 0,
            "output_tokens": 0,
            "cost_usd": 0.0,
            "cache_hit": False,
            "feature": self.feature,
            "user_id": user_id,
            "session_id": None,
            "status": "ok",
            "error_kind": None,
            "meta": {},
        }
        start = time.time()
        t0 = time.perf_counter()
        try:
            yield rec
        except Exception as exc:
            rec["status"] = "error"
            rec["error_kind"] = type(exc).__name__
            raise
        finally:
            rec["start_ts"] = _ts(start)
            rec["end_ts"] = _ts(time.time())
            rec["latency_ms"] = round((time.perf_counter() - t0) * 1000, 3)
            ordered = {
                k: rec[k]
                for k in (
                    "trace_id",
                    "span_id",
                    "parent_span_id",
                    "name",
                    "kind",
                    "start_ts",
                    "end_ts",
                    "latency_ms",
                    "model",
                    "input_tokens",
                    "output_tokens",
                    "cost_usd",
                    "cache_hit",
                    "feature",
                    "user_id",
                    "session_id",
                    "status",
                    "error_kind",
                    "meta",
                )
            }
            self.emit(ordered)


def read_spans(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]
