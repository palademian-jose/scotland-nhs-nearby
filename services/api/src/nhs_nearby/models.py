"""Pydantic models shared by ingest, the database layer and the HTTP API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Category = Literal["gp", "pharmacy", "dentist", "hospital", "ae"]
CATEGORIES: tuple[str, ...] = ("gp", "pharmacy", "dentist", "hospital", "ae")

CATEGORY_LABELS: dict[str, str] = {
    "gp": "GP practice",
    "pharmacy": "pharmacy",
    "dentist": "dental practice",
    "hospital": "hospital",
    "ae": "A&E department",
}

HEALTH_BOARDS: dict[str, str] = {
    "S08000015": "NHS Ayrshire and Arran",
    "S08000016": "NHS Borders",
    "S08000017": "NHS Dumfries and Galloway",
    "S08000019": "NHS Forth Valley",
    "S08000020": "NHS Grampian",
    "S08000022": "NHS Highland",
    "S08000024": "NHS Lothian",
    "S08000025": "NHS Orkney",
    "S08000026": "NHS Shetland",
    "S08000028": "NHS Western Isles",
    "S08000029": "NHS Fife",
    "S08000030": "NHS Tayside",
    "S08000031": "NHS Greater Glasgow and Clyde",
    "S08000032": "NHS Lanarkshire",
}


class Facility(BaseModel):
    """One row of the ``facilities`` table."""

    id: str
    category: Category
    name: str
    address: str
    postcode: str
    phone: str | None = None
    health_board: str
    lat: float = Field(ge=54.0, le=61.5)
    lon: float = Field(ge=-8.7, le=-0.5)
    source_dataset: str


class NearbyResult(Facility):
    distance_km: float


class NearbyResponse(BaseModel):
    category: Category
    lat: float
    lon: float
    count: int
    results: list[NearbyResult]


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("question")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class Intent(BaseModel):
    """Structured reading of a question; produced by the LLM call (rule-based when fake)."""

    in_scope: bool = True
    category: Category | None = None
    place: str | None = None
    limit: int = Field(default=3, ge=1, le=10)


class Citation(BaseModel):
    index: int
    id: str
    name: str
    postcode: str
    distance_km: float


class AskResponse(BaseModel):
    answer: str
    refused: bool
    intent: Intent
    resolved_place: str | None = None
    resolved_via: Literal[
        "coordinates", "postcode", "postcode_district", "gazetteer", "live_postcode", "none"
    ] = "none"
    results: list[NearbyResult]
    citations: list[Citation]
