"""Write evals/golden/queries.jsonl.

Questions and intent labels are hand-written below. The expected top-1 facility is computed here
by exhaustive Python haversine over data/sample/*.csv from the resolved place; it does not use the
SQL path or the intent parser, so the eval checks them against an independent answer.

Run: uv run python scripts/build_golden.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from nhs_nearby.geo import haversine_km
from nhs_nearby.places import PlaceResolver
from nhs_nearby.settings import REPO_ROOT

DATA = REPO_ROOT / "data"
OUT = REPO_ROOT / "evals" / "golden" / "queries.jsonl"

EDI = (55.9533, -3.1883)
ABD = (57.1497, -2.0943)
INV = (57.4778, -4.2247)
GLA = (55.8642, -4.2518)

# (question, category, place, limit, coords, tags)   category None => must be refused
CASES: list[tuple[str, str | None, str | None, int, tuple[float, float] | None, list[str]]] = [
    # postcodes that back an NHS site (exact cache hit)
    ("nearest pharmacy to EH6 6JJ", "pharmacy", "EH6 6JJ", 1, None, ["postcode"]),
    ("Where is the closest GP to AB10 1QB?", "gp", "AB10 1QB", 1, None, ["postcode"]),
    ("3 nearest dentists to G41 3YA", "dentist", "G41 3YA", 3, None, ["postcode", "limit"]),
    ("closest A&E to G51 4TF", "ae", "G51 4TF", 1, None, ["postcode", "ae"]),
    ("nearest hospital to IV2 3PF", "hospital", "IV2 3PF", 1, None, ["postcode"]),
    ("find me a chemist near PA1 1TX", "pharmacy", "PA1 1TX", 3, None, ["postcode", "synonym"]),
    ("nearest dentist to ze1 0jn", "dentist", "ZE1 0JN", 1, None, ["postcode", "lowercase"]),
    ("closest doctor to KW1 5QB", "gp", "KW1 5QB", 1, None, ["postcode", "synonym", "remote"]),
    # postcodes not in the cache (district centroid fallback)
    ("nearest pharmacy to EH8 9YL", "pharmacy", "EH8 9YL", 1, None, ["postcode", "district"]),
    ("nearest GP to G12 8QQ", "gp", "G12 8QQ", 1, None, ["postcode", "district"]),
    ("closest dentist to AB24 3FX", "dentist", "AB24 3FX", 1, None, ["postcode", "district"]),
    # towns and districts from the gazetteer
    ("closest A&E to Partick", "ae", "Partick", 1, None, ["place", "ae"]),
    ("Where is the nearest A&E in Dundee?", "ae", "Dundee", 1, None, ["place", "ae"]),
    ("nearest accident and emergency to Inverness", "ae", "Inverness", 1, None, ["place", "ae"]),
    ("3 nearest dentists in Aberdeen", "dentist", "Aberdeen", 3, None, ["place", "limit"]),
    ("find me a GP near Leith", "gp", "Leith", 3, None, ["place"]),
    ("which hospital is nearest to Stirling", "hospital", "Stirling", 1, None, ["place"]),
    ("two closest chemists around Perth", "pharmacy", "Perth", 2, None, ["place", "limit"]),
    ("is there a pharmacy in Portobello", "pharmacy", "Portobello", 3, None, ["place"]),
    ("dentists near Paisley", "dentist", "Paisley", 3, None, ["place"]),
    ("nearest GP surgery to Morningside", "gp", "Morningside", 1, None, ["place", "synonym"]),
    ("nearest A&E to Lerwick", "ae", "Lerwick", 1, None, ["place", "remote"]),
    ("5 nearest pharmacies in Glasgow", "pharmacy", "Glasgow", 5, None, ["place", "limit"]),
    ("closest casualty to Ayr", "ae", "Ayr", 1, None, ["place", "synonym", "ae"]),
    # "near me": GPS coordinates are supplied with the request
    ("nearest pharmacy", "pharmacy", None, 1, EDI, ["coordinates"]),
    ("closest GP to me", "gp", None, 1, ABD, ["coordinates"]),
    ("3 nearest dentists", "dentist", None, 3, INV, ["coordinates", "limit"]),
    ("where is the closest A&E", "ae", None, 1, GLA, ["coordinates", "ae"]),
    # free phrasing written after the rule parser was finished; some of these are expected to fail
    (
        "I just moved to Dennistoun, where can I register with a doctor?",
        "gp",
        "Dennistoun",
        3,
        None,
        ["natural"],
    ),
    (
        "Is there a hospital with an A&E near Dumfries?",
        "ae",
        "Dumfries",
        1,
        None,
        ["natural", "ae"],
    ),
    (
        "closest place to get my teeth checked in Dundee",
        "dentist",
        "Dundee",
        1,
        None,
        ["natural", "no_keyword"],
    ),
    (
        "where can I get my prescription refilled near Leith",
        "pharmacy",
        "Leith",
        3,
        None,
        ["natural", "advice_word"],
    ),
    (
        "my daughter has toothache, any dentist around Shawlands?",
        "dentist",
        "Shawlands",
        3,
        None,
        ["natural"],
    ),
    ("emergency dentist in Inverness", "dentist", "Inverness", 3, None, ["natural"]),
    # out of scope: must be refused with the fixed message
    ("what medication should I take for a headache", None, None, 1, None, ["refusal", "medical"]),
    ("how do I treat a sprained ankle", None, None, 1, None, ["refusal", "medical"]),
    ("what is the capital of Scotland", None, None, 1, None, ["refusal", "off_topic"]),
    ("is the Boots in Leith open on Sunday", None, None, 1, None, ["refusal", "hours"]),
    ("what are the symptoms of measles", None, None, 1, None, ["refusal", "medical"]),
    # unknown place: must not guess
    ("closest GP near Atlantis", "gp", "Atlantis", 1, None, ["unknown_place"]),
]


def _load_sample() -> list[dict]:
    rows: list[dict] = []
    for f in sorted((DATA / "sample").glob("*.csv")):
        with f.open(encoding="utf-8") as fh:
            rows += list(csv.DictReader(fh))
    return rows


def main() -> None:
    resolver = PlaceResolver.from_files(DATA)
    rows = _load_sample()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    for i, (question, category, place, limit, coords, tags) in enumerate(CASES, start=1):
        in_scope = category is not None
        point: tuple[float, float] | None = coords
        if place and in_scope:
            hit = resolver.resolve(place)
            point = (hit.lat, hit.lon) if hit else None
        top1: str | None = None
        if in_scope and point is not None:
            ranked = sorted(
                (haversine_km(point[0], point[1], float(r["lat"]), float(r["lon"])), r["id"])
                for r in rows
                if r["category"] == category
            )
            top1 = ranked[0][1]
        inp: dict = {"question": question}
        if coords:
            inp.update(lat=coords[0], lon=coords[1])
        mode = "refusal_miss" if not in_scope else ("place_miss" if point is None else "wrong_top1")
        lines.append(
            json.dumps(
                {
                    "id": f"g-{i:04d}",
                    "input": inp,
                    "expected": {
                        "in_scope": in_scope,
                        "category": category,
                        "place": place,
                        "limit": limit,
                        "top1_id": top1,
                    },
                    "failure_mode": mode,
                    "tags": tags,
                    "source": "human",
                }
            )
        )
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {len(lines)} cases to {Path(OUT).relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
