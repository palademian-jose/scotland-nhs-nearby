"""DuckDB access: one ``facilities`` table, nearest-N by haversine distance computed in SQL."""

from __future__ import annotations

import threading
from pathlib import Path

import duckdb

from nhs_nearby.geo import EARTH_RADIUS_KM
from nhs_nearby.models import Facility, NearbyResult
from nhs_nearby.settings import Settings

COLUMNS = (
    "id",
    "category",
    "name",
    "address",
    "postcode",
    "phone",
    "health_board",
    "lat",
    "lon",
    "source_dataset",
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS facilities (
    id VARCHAR PRIMARY KEY,
    category VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    address VARCHAR NOT NULL,
    postcode VARCHAR NOT NULL,
    phone VARCHAR,
    health_board VARCHAR NOT NULL,
    lat DOUBLE NOT NULL,
    lon DOUBLE NOT NULL,
    source_dataset VARCHAR NOT NULL
)
"""

_NEARBY_SQL = f"""
SELECT {", ".join(COLUMNS)},
       2 * {EARTH_RADIUS_KM} * asin(sqrt(
           pow(sin(radians(lat - ?) / 2), 2)
           + cos(radians(?)) * cos(radians(lat)) * pow(sin(radians(lon - ?) / 2), 2)
       )) AS distance_km
FROM facilities
WHERE category = ?
ORDER BY distance_km, id
LIMIT ?
"""


class Database:
    """Thin wrapper over a DuckDB connection. Each call uses its own cursor (thread-safe)."""

    def __init__(self, con: duckdb.DuckDBPyConnection, source: str) -> None:
        self._con = con
        self.source = source
        self._lock = threading.Lock()

    # -- construction -------------------------------------------------------------------------
    @classmethod
    def from_facilities(cls, rows: list[Facility], source: str = "memory") -> Database:
        con = duckdb.connect(":memory:")
        con.execute(SCHEMA)
        db = cls(con, source)
        db.insert(rows)
        return db

    @classmethod
    def from_csv_dir(cls, directory: Path) -> Database:
        """Load every ``*.csv`` in ``directory`` (the committed sample layout) into memory."""
        con = duckdb.connect(":memory:")
        con.execute(SCHEMA)
        files = sorted(directory.glob("*.csv"))
        if not files:
            raise FileNotFoundError(f"no sample CSVs in {directory}")
        for f in files:
            con.execute(
                f"INSERT INTO facilities SELECT {', '.join(COLUMNS)} "
                "FROM read_csv(?, header=true, all_varchar=false, "
                "types={'phone': 'VARCHAR', 'postcode': 'VARCHAR'})",
                [f.as_posix()],
            )
        return cls(con, f"sample:{directory.name}")

    @classmethod
    def open(cls, settings: Settings) -> Database:
        """The built database when present, otherwise the committed sample (works offline)."""
        db_path = settings.db_path or settings.data_dir / "nhs.duckdb"
        if not settings.use_sample and db_path.exists():
            con = duckdb.connect(str(db_path), read_only=True)
            return cls(con, f"duckdb:{db_path.name}")
        return cls.from_csv_dir(settings.data_dir / "sample")

    # -- writes -------------------------------------------------------------------------------
    def insert(self, rows: list[Facility]) -> None:
        if not rows:
            return
        data = [tuple(getattr(r, c) for c in COLUMNS) for r in rows]
        with self._lock:
            self._con.executemany(
                f"INSERT INTO facilities VALUES ({', '.join('?' * len(COLUMNS))})", data
            )

    # -- reads --------------------------------------------------------------------------------
    def nearby(self, lat: float, lon: float, category: str, limit: int = 5) -> list[NearbyResult]:
        cur = self._con.cursor()
        try:
            rows = cur.execute(_NEARBY_SQL, [lat, lat, lon, category, limit]).fetchall()
        finally:
            cur.close()
        names = [*COLUMNS, "distance_km"]
        out: list[NearbyResult] = []
        for r in rows:
            d = dict(zip(names, r, strict=True))
            d["distance_km"] = round(d["distance_km"], 3)
            out.append(NearbyResult(**d))
        return out

    def get(self, facility_id: str) -> Facility | None:
        cur = self._con.cursor()
        try:
            row = cur.execute(
                f"SELECT {', '.join(COLUMNS)} FROM facilities WHERE id = ?", [facility_id]
            ).fetchone()
        finally:
            cur.close()
        return Facility(**dict(zip(COLUMNS, row, strict=True))) if row else None

    def counts(self) -> dict[str, int]:
        cur = self._con.cursor()
        try:
            rows = cur.execute(
                "SELECT category, count(*) FROM facilities GROUP BY category ORDER BY category"
            ).fetchall()
        finally:
            cur.close()
        return {str(c): int(n) for c, n in rows}

    def close(self) -> None:
        self._con.close()
