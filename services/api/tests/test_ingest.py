import json
from pathlib import Path

import httpx
import pytest

from nhs_nearby.db import Database
from nhs_nearby.ingest import geocode as gc
from nhs_nearby.ingest.cli import pick_sample, to_facilities, write_sample
from nhs_nearby.ingest.sources import SOURCES, load_all, title_case

FIX = Path(__file__).parent / "fixtures"


@pytest.fixture
def raw_dir(tmp_path: Path) -> Path:
    for s in SOURCES:
        (tmp_path / s.filename).write_bytes((FIX / s.filename).read_bytes())
    return tmp_path


def test_title_case_keeps_acronyms():
    assert title_case("BOOTS UK LTD") == "Boots UK Ltd"
    assert title_case("NHS GP centre") == "NHS GP Centre"


def test_load_all_validates_and_filters(raw_dir: Path):
    rows = {r.id: r for r in load_all(raw_dir)}
    assert "gp-10002" in rows
    assert "gp-10003" not in rows  # blank postcode is dropped
    assert rows["ph-1030"].name == "A G Bannerman Ltd"
    assert rows["ph-1030"].address == "220/222 Saracen Street, Glasgow"
    assert rows["dn-6"].postcode == "AB10 1QN"
    assert rows["ho-A101H"].postcode == "KA27 8LF"
    # Only the open Type 1 department becomes an A&E row, and it borrows the hospital address.
    ae = [r for r in rows.values() if r.category == "ae"]
    assert [r.id for r in ae] == ["ae-A210H"]
    assert ae[0].address == "Dalmellington Road, Ayr"


def test_to_facilities_drops_unresolved_and_non_scottish(raw_dir: Path):
    raw = load_all(raw_dir)
    coords = {
        "DD2 5NH": [56.47, -3.0],
        "G22 5ER": [55.89, -4.26],
        "NE33 1LE": [54.99, -1.43],
        "AB10 1QN": [57.14, -2.1],
        "KA27 8LF": [55.53, -5.12],
        "KA6 6DX": [55.43, -4.59],
    }
    kept, dropped = to_facilities(raw, coords)
    ids = {f.id for f in kept}
    assert "ph-8600" not in ids  # English contractor, no Scottish board
    assert dropped["pharmacy"] == 1
    assert next(f for f in kept if f.id == "gp-10002").health_board == "NHS Tayside"


def test_geocode_uses_cache_and_only_looks_up_missing(tmp_path: Path):
    cache = tmp_path / "cache.json"
    cache.write_text(json.dumps({"EH8 9YL": [55.94, -3.17]}))
    calls: list[list[str]] = []

    def lookup(batch: list[str]):
        calls.append(batch)
        return {p: [56.0, -3.0] for p in batch}

    out = gc.geocode(["EH8 9YL", "G1 1AA"], cache, lookup=lookup)
    assert calls == [["G1 1AA"]]
    assert out["G1 1AA"] == [56.0, -3.0]
    assert json.loads(cache.read_text())["G1 1AA"] == [56.0, -3.0]
    gc.geocode(["EH8 9YL", "G1 1AA"], cache, lookup=lookup)
    assert len(calls) == 1  # fully cached the second time


def test_bulk_lookup_batches_of_100_and_handles_misses():
    seen: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen.append(len(body["postcodes"]))
        ok = {"latitude": 56.1, "longitude": -3.1}
        result = [
            {"query": p, "result": None if p.endswith("0 1AA") else ok} for p in body["postcodes"]
        ]
        return httpx.Response(200, json={"status": 200, "result": result})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    pcs = [f"EH{i} 1AA" for i in range(1, 251)]
    out = gc.bulk_lookup(pcs, client=client)
    assert seen == [100, 100, 50]
    assert out["EH10 1AA"] is None
    assert out["EH11 1AA"] == [56.1, -3.1]


def test_sample_is_deterministic_and_loads(raw_dir: Path, tmp_path: Path):
    raw = load_all(raw_dir)
    coords = {r.postcode: [56.0, -3.0] for r in raw}
    kept, _ = to_facilities(raw, coords)
    assert pick_sample(kept) == pick_sample(kept)
    out = tmp_path / "sample"
    write_sample(kept, out)
    db = Database.from_csv_dir(out)
    assert sum(db.counts().values()) == len(kept)
