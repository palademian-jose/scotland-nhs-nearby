import csv

from nhs_nearby.geo import haversine_km
from nhs_nearby.settings import REPO_ROOT

SAMPLE = REPO_ROOT / "data" / "sample"


def _rows(category: str):
    with (SAMPLE / f"{category}.csv").open(encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def test_counts_cover_all_categories(sample_db):
    assert set(sample_db.counts()) == {"gp", "pharmacy", "dentist", "hospital", "ae"}
    assert sum(sample_db.counts().values()) >= 200


def test_sql_haversine_matches_python_bruteforce(sample_db):
    lat, lon = 55.9533, -3.1883  # Edinburgh
    got = sample_db.nearby(lat, lon, "pharmacy", 5)
    brute = sorted(
        (haversine_km(lat, lon, float(r["lat"]), float(r["lon"])), r["id"])
        for r in _rows("pharmacy")
    )[:5]
    assert [r.id for r in got] == [i for _, i in brute]
    for r, (d, _) in zip(got, brute, strict=True):
        assert abs(r.distance_km - d) < 0.002


def test_results_sorted_and_limited(sample_db):
    rows = sample_db.nearby(57.1497, -2.0943, "gp", 7)
    assert len(rows) == 7
    assert [r.distance_km for r in rows] == sorted(r.distance_km for r in rows)
    assert all(r.category == "gp" for r in rows)


def test_get_by_id(sample_db):
    first = sample_db.nearby(55.86, -4.25, "hospital", 1)[0]
    assert sample_db.get(first.id).name == first.name
    assert sample_db.get("nope") is None


def test_every_row_has_scottish_coordinates_and_source(sample_db):
    rows = sample_db.nearby(56.5, -4.0, "dentist", 1000)
    assert rows
    assert all(54.5 < r.lat < 61 and -8.7 < r.lon < -0.7 for r in rows)
    assert all(r.source_dataset and r.health_board.startswith("NHS") for r in rows)
