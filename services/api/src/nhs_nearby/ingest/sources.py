"""Source datasets (opendata.nhs.scot, Open Government Licence v3) and their row parsers.

Raw CSVs are read with ``csv.DictReader`` only; nothing downloaded is ever executed.
"""

from __future__ import annotations

import csv
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path

from pydantic import BaseModel, ValidationError

from nhs_nearby.geo import normalise_postcode
from nhs_nearby.models import Category

_BASE = "https://www.opendata.nhs.scot/dataset"


@dataclass(frozen=True)
class Source:
    key: str
    category: Category
    title: str
    filename: str
    url: str
    page: str


SOURCES: tuple[Source, ...] = (
    Source(
        "gp",
        "gp",
        "GP Practice Contact Details and List Sizes (1 Oct 2026)",
        "gp.csv",
        f"{_BASE}/f23655c3-6e23-4103-a511-a80d998adb90/resource/"
        "ddfcdb81-860a-4851-8925-a094b63e1a00/download/"
        "practice_contact_details_20261001_opendata.csv",
        "https://www.opendata.nhs.scot/dataset/gp-practice-contact-details-and-list-sizes",
    ),
    Source(
        "pharmacy",
        "pharmacy",
        "Dispenser Location Contact Details (July 2026)",
        "pharm.csv",
        f"{_BASE}/a30fde16-1226-49b3-b13d-eb90e39c2058/resource/"
        "94ce388f-45cc-4096-8ac8-fb4fd0c593c2/download/dispenser_contactdetails_202607.csv",
        "https://www.opendata.nhs.scot/dataset/dispenser-location-contact-details",
    ),
    Source(
        "dentist",
        "dentist",
        "Dental Practices and Patient Registrations (as at 31 Mar 2026)",
        "dental.csv",
        f"{_BASE}/2f218ba7-6695-4b22-867d-41383ae36de7/resource/"
        "6c0d19e7-ba5b-46c2-8135-3200b59ad482/download/"
        "nhs-dental-practices-and-nhs-dental-registrations-as-at-31-mar-2026.csv",
        "https://www.opendata.nhs.scot/dataset/dental-practices-and-patient-registrations",
    ),
    Source(
        "hospital",
        "hospital",
        "Hospital Codes (hospitals.csv)",
        "hosp.csv",
        f"{_BASE}/cbd1802e-0e04-4282-88eb-d7bdcfb120f0/resource/"
        "c698f450-eeed-41a0-88f7-c1e40a568acc/download/hospitals.csv",
        "https://www.opendata.nhs.scot/dataset/hospital-codes",
    ),
    Source(
        "ae",
        "ae",
        "NHS Scotland Accident and Emergency Sites (list of 9 Sep 2025)",
        "ae.csv",
        f"{_BASE}/a877470a-06a9-492f-b9e8-992f758894d0/resource/"
        "1a4e3f48-3d9b-4769-80e9-3ef6d27852fe/download/ae_hospital_site_list_09_09_2025.csv",
        "https://www.opendata.nhs.scot/dataset/nhs-scotland-accident-emergency-sites",
    ),
)


class RawFacility(BaseModel):
    """A validated source row, before geocoding."""

    id: str
    category: Category
    name: str
    address: str
    postcode: str
    phone: str | None
    health_board: str  # S08 code
    source_dataset: str


def _clean(value: str | None) -> str:
    v = (value or "").strip()
    return "" if v.upper() in {"NA", "N/A", "NONE", "Z", "-"} else v


def _join(*parts: str | None) -> str:
    seen: list[str] = []
    for p in parts:
        c = _clean(p)
        if c and c not in seen:
            seen.append(c)
    return ", ".join(seen)


_KEEP_UPPER = {"NHS", "GP", "A&E", "UK", "II", "III", "IV", "HM", "NHS."}


def title_case(text: str) -> str:
    """Title-case shouting names while keeping short acronyms readable."""
    words = []
    for w in text.split():
        if w.upper() in _KEEP_UPPER:
            words.append(w.upper())
        elif w.isupper() or w.islower():
            words.append(w.capitalize())
        else:
            words.append(w)
    return " ".join(words)


def _read(path: Path) -> Iterator[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        yield from csv.DictReader(fh)


def _safe(make: Callable[[], RawFacility]) -> Iterator[RawFacility]:
    """Yield the model, or nothing when the row fails validation (blank name or postcode)."""
    try:
        item = make()
    except (ValidationError, KeyError):
        return
    if item.name and item.postcode:
        yield item


def parse_gp(path: Path, source: Source) -> Iterator[RawFacility]:
    for row in _read(path):
        yield from _safe(
            lambda row=row: RawFacility(
                id=f"gp-{row['PracticeCode'].strip()}",
                category="gp",
                name=_clean(row["GPPracticeName"]),
                address=_join(
                    row["AddressLine1"],
                    row["AddressLine2"],
                    row["AddressLine3"],
                    row["AddressLine4"],
                ),
                postcode=normalise_postcode(row["Postcode"]) or "",
                phone=_clean(row["TelephoneNumber"]) or None,
                health_board=row["HB"].strip(),
                source_dataset=source.title,
            )
        )


def parse_pharmacy(path: Path, source: Source) -> Iterator[RawFacility]:
    for row in _read(path):
        yield from _safe(
            lambda row=row: RawFacility(
                id=f"ph-{row['DispCode'].strip()}",
                category="pharmacy",
                name=title_case(_clean(row["DispLocationName"])),
                address=title_case(
                    _join(
                        row["DispLocationAddress1"],
                        row["DispLocationAddress2"],
                        row["DispLocationAddress3"],
                        row["DispLocationAddress4"],
                    )
                ),
                postcode=normalise_postcode(row["DispLocationPostcode"]) or "",
                phone=_clean(row["DispLocationTelNo"]) or None,
                health_board=row["HB2019"].strip(),
                source_dataset=source.title,
            )
        )


def parse_dentist(path: Path, source: Source) -> Iterator[RawFacility]:
    for row in _read(path):
        yield from _safe(
            lambda row=row: RawFacility(
                id=f"dn-{row['Dental_Practice_Code'].strip()}",
                category="dentist",
                name=title_case(_clean(row["address1"])),
                address=title_case(_join(row["address2"], row["address3"])),
                postcode=normalise_postcode(row["pc7"]) or "",
                phone=None,
                health_board=row["HB"].strip(),
                source_dataset=source.title,
            )
        )


def parse_hospital(path: Path, source: Source) -> Iterator[RawFacility]:
    for row in _read(path):
        yield from _safe(
            lambda row=row: RawFacility(
                id=f"ho-{row['HospitalCode'].strip()}",
                category="hospital",
                name=_clean(row["HospitalName"]),
                address=_join(
                    row["AddressLine1"],
                    row["AddressLine2"],
                    row["AddressLine3"],
                    row["AddressLine4"],
                ),
                postcode=normalise_postcode(row["Postcode"]) or "",
                phone=None,
                health_board=row["HealthBoard"].strip(),
                source_dataset=source.title,
            )
        )


def parse_ae(
    path: Path, source: Source, hospitals: dict[str, RawFacility]
) -> Iterator[RawFacility]:
    """Open Type 1 (consultant-led) A&E sites; the address comes from the hospital list."""
    for row in _read(path):
        if row["Status"].strip().lower() != "open":
            continue
        if row["CurrentDepartmentType"].strip() != "Type 1":
            continue
        code = row["TreatmentLocationCode"].strip()
        base = hospitals.get(f"ho-{code}")
        yield from _safe(
            lambda row=row, code=code, base=base: RawFacility(
                id=f"ae-{code}",
                category="ae",
                name=f"{_clean(row['TreatmentLocationName'])} (A&E)",
                address=base.address if base else "",
                postcode=normalise_postcode(row["TreatmentLocationPostcode"]) or "",
                phone=None,
                health_board=row["HB"].strip(),
                source_dataset=source.title,
            )
        )


def load_all(raw_dir: Path) -> list[RawFacility]:
    by_key = {s.key: s for s in SOURCES}
    hospitals = list(parse_hospital(raw_dir / by_key["hospital"].filename, by_key["hospital"]))
    hosp_by_id = {h.id: h for h in hospitals}
    out: list[RawFacility] = []
    out += parse_gp(raw_dir / by_key["gp"].filename, by_key["gp"])
    out += parse_pharmacy(raw_dir / by_key["pharmacy"].filename, by_key["pharmacy"])
    out += parse_dentist(raw_dir / by_key["dentist"].filename, by_key["dentist"])
    out += hospitals
    out += parse_ae(raw_dir / by_key["ae"].filename, by_key["ae"], hosp_by_id)
    # A source listing the same code twice keeps its first row.
    seen: set[str] = set()
    unique: list[RawFacility] = []
    for item in out:
        if item.id not in seen:
            seen.add(item.id)
            unique.append(item)
    return unique
