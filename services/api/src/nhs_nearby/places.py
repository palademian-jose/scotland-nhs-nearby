"""Resolve a place (postcode or town/area name) to coordinates, offline first.

Order: full postcode in the committed geocode cache -> optional live postcodes.io lookup ->
centroid of cached postcodes in the same postcode district -> gazetteer of Scottish places.
"""

from __future__ import annotations

import json
import re
import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import httpx

from nhs_nearby.geo import find_postcode

Via = Literal["postcode", "live_postcode", "postcode_district", "gazetteer"]


@dataclass(frozen=True)
class ResolvedPlace:
    lat: float
    lon: float
    label: str
    via: Via


def _norm(text: str) -> str:
    t = re.sub(r"[^a-z0-9&' ]+", " ", text.lower())
    t = re.sub(r"^(the )", "", t.strip())
    return re.sub(r"\s+", " ", t).strip()


class PlaceResolver:
    def __init__(
        self,
        geocode_cache: dict[str, list[float] | None],
        gazetteer: dict[str, list[float]],
        *,
        live: bool = False,
        live_base_url: str = "https://api.postcodes.io",
        http: httpx.Client | None = None,
    ) -> None:
        self.cache = {k: v for k, v in geocode_cache.items() if v}
        self.gazetteer = {_norm(k): (float(v[0]), float(v[1])) for k, v in gazetteer.items()}
        self.live = live
        self.live_base_url = live_base_url
        self._http = http
        self._districts: dict[str, tuple[float, float]] = {}
        by_district: dict[str, list[list[float]]] = {}
        for pc, ll in self.cache.items():
            by_district.setdefault(pc.split(" ")[0], []).append(ll)
        for district, pts in by_district.items():
            self._districts[district] = (
                statistics.fmean(p[0] for p in pts),
                statistics.fmean(p[1] for p in pts),
            )

    @classmethod
    def from_files(cls, data_dir: Path, **kwargs) -> PlaceResolver:
        cache_path = data_dir / "geocode_cache.json"
        gaz_path = data_dir / "gazetteer.json"
        cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
        gaz = json.loads(gaz_path.read_text(encoding="utf-8")) if gaz_path.exists() else {}
        return cls(cache, gaz, **kwargs)

    # -- public -------------------------------------------------------------------------------
    def gazetteer_match(self, text: str) -> str | None:
        """Longest gazetteer name that appears as whole words in ``text``."""
        t = f" {_norm(text)} "
        best: str | None = None
        for name in self.gazetteer:
            if f" {name} " in t and (best is None or len(name) > len(best)):
                best = name
        return best

    def resolve(self, place: str) -> ResolvedPlace | None:
        pc = find_postcode(place)
        if pc:
            return self._resolve_postcode(pc)
        key = _norm(place)
        if key in self.gazetteer:
            lat, lon = self.gazetteer[key]
            return ResolvedPlace(lat, lon, key.title(), "gazetteer")
        match = self.gazetteer_match(place)
        if match:
            lat, lon = self.gazetteer[match]
            return ResolvedPlace(lat, lon, match.title(), "gazetteer")
        return None

    # -- internals ----------------------------------------------------------------------------
    def _resolve_postcode(self, pc: str) -> ResolvedPlace | None:
        if pc in self.cache:
            lat, lon = self.cache[pc]
            return ResolvedPlace(lat, lon, pc, "postcode")
        if self.live:
            hit = self._live_lookup(pc)
            if hit:
                return ResolvedPlace(hit[0], hit[1], pc, "live_postcode")
        district = pc.split(" ")[0]
        if district in self._districts:
            lat, lon = self._districts[district]
            return ResolvedPlace(lat, lon, f"{pc} (approximate)", "postcode_district")
        return None

    def _live_lookup(self, pc: str) -> tuple[float, float] | None:
        """One postcodes.io lookup. Any network or parse failure returns None (never raises)."""
        try:
            client = self._http or httpx.Client(timeout=5)
            try:
                resp = client.get(f"{self.live_base_url}/postcodes/{pc.replace(' ', '%20')}")
            finally:
                if self._http is None:
                    client.close()
            if resp.status_code != 200:
                return None
            res = resp.json().get("result") or {}
            if res.get("latitude") is None or res.get("longitude") is None:
                return None
            return float(res["latitude"]), float(res["longitude"])
        except (httpx.HTTPError, ValueError):
            return None
