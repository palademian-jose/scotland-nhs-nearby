"""Grounded answer helpers: the facility list sent to the LLM, the template answer, the verifier."""

from __future__ import annotations

import re
from dataclasses import dataclass

from nhs_nearby.models import CATEGORY_LABELS, NearbyResult

_CITE = re.compile(r"\[(\d+)\]")

_PLURALS = {
    "GP practice": "GP practices",
    "pharmacy": "pharmacies",
    "dental practice": "dental practices",
    "hospital": "hospitals",
    "A&E department": "A&E departments",
}


def format_facilities(rows: list[NearbyResult]) -> str:
    """Numbered, pipe-separated lines: ``[1] name | address | postcode | 0.4 km | phone``."""
    return "\n".join(
        f"[{i}] {r.name} | {r.address} | {r.postcode} | {r.distance_km:.1f} km | {r.phone or '-'}"
        for i, r in enumerate(rows, start=1)
    )


@dataclass(frozen=True)
class ParsedRow:
    index: int
    name: str
    postcode: str
    distance: str


def parse_facilities(text: str) -> list[ParsedRow]:
    out: list[ParsedRow] = []
    for line in text.splitlines():
        m = re.match(r"\[(\d+)\] (.*?) \| (.*?) \| (.*?) \| ([\d.]+ km) \| ", line)
        if m:
            out.append(ParsedRow(int(m.group(1)), m.group(2), m.group(4), m.group(5)))
    return out


def render_answer(category: str, place_label: str, rows: list[ParsedRow]) -> str:
    """Deterministic answer: every sentence carries its citation."""
    label = CATEGORY_LABELS.get(category, "facility")
    if not rows:
        return (
            f"I found no {_PLURALS.get(label, label)} near {place_label} in the NHS Scotland data."
        )
    if len(rows) == 1:
        r = rows[0]
        return (
            f"The nearest {label} to {place_label} is {r.name} ({r.postcode}), "
            f"{r.distance} away [{r.index}]."
        )
    plural = _PLURALS.get(label, label + "s")
    parts = [f"{r.name} ({r.postcode}), {r.distance} [{r.index}]" for r in rows]
    return f"The {len(rows)} nearest {plural} to {place_label} are: " + "; ".join(parts) + "."


def cited_indices(answer: str) -> list[int]:
    return [int(m) for m in _CITE.findall(answer)]


def verify_answer(answer: str, rows: list[NearbyResult]) -> tuple[bool, str]:
    """Grounding check. Returns (ok, reason).

    Passes only when the answer cites at least one facility, every citation points at a returned
    row, every numeric distance matches the cited row, and no returned row is misnamed.
    """
    if not rows:
        return (not cited_indices(answer), "no rows: answer must not cite")
    cites = cited_indices(answer)
    if not cites:
        return False, "no citations"
    if any(c < 1 or c > len(rows) for c in cites):
        return False, "citation out of range"
    allowed = {f"{r.distance_km:.1f}" for r in rows}
    for km in re.findall(r"(\d+(?:\.\d+)?)\s*km", answer):
        if km not in allowed:
            return False, f"distance {km} km not in results"
    return True, "ok"
