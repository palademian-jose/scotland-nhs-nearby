"""Postcode -> (lat, lon) using the free postcodes.io bulk endpoint, cached in a committed JSON.

The cache makes ingest reproducible offline: only postcodes missing from it trigger a request.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterable
from pathlib import Path

import httpx

BATCH = 100  # postcodes.io limit per bulk request

Cache = dict[str, list[float] | None]  # postcode -> [lat, lon]; None = looked up, not found


def load_cache(path: Path) -> Cache:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_cache(path: Path, cache: Cache) -> None:
    ordered = {k: cache[k] for k in sorted(cache)}
    path.write_text(json.dumps(ordered, separators=(",", ":")) + "\n", encoding="utf-8")


def bulk_lookup(
    postcodes: list[str],
    *,
    base_url: str = "https://api.postcodes.io",
    client: httpx.Client | None = None,
) -> Cache:
    """Resolve postcodes in batches of 100. Raises httpx errors if the service is unreachable."""
    out: Cache = {}
    http = client or httpx.Client(timeout=30)
    try:
        for i in range(0, len(postcodes), BATCH):
            batch = postcodes[i : i + BATCH]
            resp = http.post(f"{base_url}/postcodes", json={"postcodes": batch})
            resp.raise_for_status()
            for item in resp.json().get("result", []):
                res = item.get("result")
                if res and res.get("latitude") is not None and res.get("longitude") is not None:
                    out[item["query"]] = [round(res["latitude"], 6), round(res["longitude"], 6)]
                else:
                    out[item["query"]] = None
    finally:
        if client is None:
            http.close()
    return out


def geocode(
    postcodes: Iterable[str],
    cache_path: Path,
    *,
    lookup: Callable[[list[str]], Cache] = bulk_lookup,
) -> Cache:
    """Return the cache after resolving every postcode not already in it (and saving it)."""
    cache = load_cache(cache_path)
    missing = sorted({p for p in postcodes if p not in cache})
    if missing:
        cache.update(lookup(missing))
        save_cache(cache_path, cache)
    return cache
