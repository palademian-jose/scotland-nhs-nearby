"""Geographic helpers: UK postcode normalisation and haversine distance."""

from __future__ import annotations

import math
import re

EARTH_RADIUS_KM = 6371.0088

# Full UK postcode, with or without the space. Used both to validate and to find postcodes in text.
POSTCODE_RE = re.compile(r"\b([A-Z]{1,2}[0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})\b", re.IGNORECASE)


def normalise_postcode(raw: str | None) -> str | None:
    """Return ``"EH8 9YL"`` style text, or None when ``raw`` is not a full UK postcode."""
    if not raw:
        return None
    m = POSTCODE_RE.fullmatch(raw.strip())
    if not m:
        return None
    return f"{m.group(1).upper()} {m.group(2).upper()}"


def find_postcode(text: str) -> str | None:
    """First full postcode inside free text, normalised."""
    m = POSTCODE_RE.search(text)
    if not m:
        return None
    return f"{m.group(1).upper()} {m.group(2).upper()}"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))
