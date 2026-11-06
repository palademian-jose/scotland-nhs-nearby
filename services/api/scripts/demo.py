"""Offline demo: runs the API in process against the committed sample with the fake provider."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from nhs_nearby.api import create_app
from nhs_nearby.settings import Settings

QUESTIONS = [
    ("nearest pharmacy to EH8 9YL", None),
    ("where is the closest A&E to Partick", None),
    ("3 nearest dentists in Aberdeen", None),
    ("closest GP to me", (57.4778, -4.2247)),
    ("what medication should I take for a headache", None),
    ("nearest dentist to Atlantis", None),
]


def main() -> None:
    os.environ.setdefault("LLM_PROVIDER", "fake")
    trace = Path(tempfile.mkdtemp()) / "spans.jsonl"
    client = TestClient(create_app(Settings(use_sample=True, trace_path=trace)))
    meta = client.get("/meta").json()
    print(f"data: {meta['source']}  rows: {meta['counts']}  llm: {meta['llm_provider']}\n")

    print("GET /nearby?lat=55.9533&lon=-3.1883&category=gp&limit=3")
    for r in client.get(
        "/nearby", params={"lat": 55.9533, "lon": -3.1883, "category": "gp", "limit": 3}
    ).json()["results"]:
        print(f"  {r['distance_km']:5.2f} km  {r['name']}  {r['postcode']}  ({r['health_board']})")

    for question, coords in QUESTIONS:
        body: dict = {"question": question}
        if coords:
            body.update(lat=coords[0], lon=coords[1])
        r = client.post("/ask", json=body).json()
        print(f"\nPOST /ask  {question!r}")
        print(f"  intent: {r['intent']}  resolved via: {r['resolved_via']}")
        print(f"  answer: {r['answer']}")
    n = len(trace.read_text(encoding="utf-8").splitlines())
    print(f"\n{n} trace spans written to {trace}")


if __name__ == "__main__":
    main()
