"""``nhs-ingest``: download -> validate -> geocode -> data/nhs.duckdb + committed sample CSVs.

Subcommands
  download   fetch the five CSVs into data/raw/ (gitignored, untrusted input)
  build      parse raw CSVs, geocode with the committed cache, write the DuckDB file and sample
  sample     reload only the committed sample (offline smoke check, prints row counts)
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path

import duckdb
import httpx

from nhs_nearby.db import COLUMNS, SCHEMA, Database
from nhs_nearby.ingest.geocode import geocode
from nhs_nearby.ingest.sources import SOURCES, RawFacility, load_all
from nhs_nearby.models import HEALTH_BOARDS, Facility
from nhs_nearby.settings import get_settings

SAMPLE_TARGETS = {"gp": 55, "pharmacy": 55, "dentist": 50, "hospital": 40, "ae": 1000}


def download(raw_dir: Path) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        for s in SOURCES:
            resp = client.get(s.url)
            resp.raise_for_status()
            (raw_dir / s.filename).write_bytes(resp.content)
            print(f"downloaded {s.filename}: {len(resp.content):,} bytes  <- {s.url}")


def to_facilities(
    raw: list[RawFacility], coords: dict[str, list[float] | None]
) -> tuple[list[Facility], Counter[str]]:
    """Attach coordinates and validate. Rows without usable coordinates are dropped and counted."""
    kept: list[Facility] = []
    dropped: Counter[str] = Counter()
    for r in raw:
        ll = coords.get(r.postcode)
        # Dispenser lists include cross-border (English) contractors with no Scottish board.
        if not ll or r.health_board not in HEALTH_BOARDS:
            dropped[r.category] += 1
            continue
        try:
            kept.append(
                Facility(
                    **r.model_dump(exclude={"health_board"}),
                    health_board=HEALTH_BOARDS.get(r.health_board, r.health_board),
                    lat=ll[0],
                    lon=ll[1],
                )
            )
        except ValueError:
            dropped[r.category] += 1
    return kept, dropped


def pick_sample(facilities: list[Facility]) -> list[Facility]:
    """Evenly spaced rows per category, ordered by health board and postcode (deterministic)."""
    out: list[Facility] = []
    for cat, target in SAMPLE_TARGETS.items():
        rows = sorted(
            (f for f in facilities if f.category == cat),
            key=lambda f: (f.health_board, f.postcode, f.id),
        )
        if len(rows) <= target:
            out += rows
            continue
        step = len(rows) / target
        out += [rows[int(i * step)] for i in range(target)]
    return out


def write_sample(sample: list[Facility], directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for cat in SAMPLE_TARGETS:
        rows = [f for f in sample if f.category == cat]
        with (directory / f"{cat}.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh, lineterminator="\n")
            w.writerow(COLUMNS)
            for f in rows:
                w.writerow([getattr(f, c) if getattr(f, c) is not None else "" for c in COLUMNS])


def write_duckdb(facilities: list[Facility], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    con = duckdb.connect(str(path))
    con.execute(SCHEMA)
    con.executemany(
        f"INSERT INTO facilities VALUES ({', '.join('?' * len(COLUMNS))})",
        [tuple(getattr(f, c) for c in COLUMNS) for f in facilities],
    )
    con.execute("CREATE INDEX IF NOT EXISTS idx_category ON facilities(category)")
    con.close()


def build(data_dir: Path, report_path: Path | None) -> dict:
    raw = load_all(data_dir / "raw")
    postcodes = {r.postcode for r in raw}
    coords = geocode(postcodes, data_dir / "geocode_cache.json")
    facilities, dropped = to_facilities(raw, coords)
    write_duckdb(facilities, data_dir / "nhs.duckdb")
    sample = pick_sample(facilities)
    write_sample(sample, data_dir / "sample")
    report = {
        "parsed_rows": dict(sorted(Counter(r.category for r in raw).items())),
        "loaded_rows": dict(sorted(Counter(f.category for f in facilities).items())),
        "dropped_no_coordinates_or_not_scottish": dict(sorted(dropped.items())),
        "sample_rows": dict(sorted(Counter(f.category for f in sample).items())),
        "unique_postcodes": len(postcodes),
    }
    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="nhs-ingest", description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("download")
    p_build = sub.add_parser("build")
    p_build.add_argument("--report", type=Path, default=None)
    sub.add_parser("sample")
    args = parser.parse_args(argv)

    settings = get_settings()
    if args.cmd == "download":
        download(settings.data_dir / "raw")
    elif args.cmd == "build":
        print(json.dumps(build(settings.data_dir, args.report), indent=2))
    else:
        db = Database.from_csv_dir(settings.data_dir / "sample")
        print(json.dumps(db.counts(), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
