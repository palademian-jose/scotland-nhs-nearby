"""Prompts for the two LLM calls and the rule-based intent parser the fake provider uses.

Call 1 (``INTENT_SYSTEM``) turns a question into JSON ``{in_scope, category, place, limit}``.
Call 2 (``ANSWER_SYSTEM``) writes a short answer that may only use the numbered facilities.
The fake provider recognises the calls by the marker strings below.
"""

from __future__ import annotations

import json
import re

from nhs_nearby.geo import find_postcode
from nhs_nearby.models import Intent
from nhs_nearby.places import PlaceResolver

INTENT_MARKER = "TASK: EXTRACT_INTENT"
ANSWER_MARKER = "TASK: WRITE_ANSWER"

INTENT_SYSTEM = f"""{INTENT_MARKER}
You read a question about NHS services in Scotland and reply with one JSON object only:
{{"in_scope": true|false, "category": "gp"|"pharmacy"|"dentist"|"hospital"|"ae"|null,
 "place": string|null, "limit": integer 1-10}}
Rules:
- in_scope is true only when the user wants to find where a GP practice, pharmacy, dental practice,
  hospital or A&E department is. Medical advice, medication, symptoms, opening hours, waiting
  times and anything else are out of scope: set in_scope false and category null.
- place is the town, area or postcode the user names, copied as written, or null when the user
  names none (the app then uses their GPS position).
- limit is how many results the user asked for; use 1 for "the nearest X" and 3 otherwise.
Reply with JSON and nothing else."""

ANSWER_SYSTEM = f"""{ANSWER_MARKER}
Answer the question using ONLY the numbered facilities provided. Rules:
- Every fact you state must carry the citation of the facility it came from, like [1].
- Give name, postcode and distance for each facility you mention. Do not invent opening hours,
  services, phone numbers or any other detail that is not in the list.
- If the list is empty, say that nothing was found. Keep the answer under 80 words."""

REFUSAL_MESSAGE = (
    "I can only help you find NHS GP practices, pharmacies, dental practices, hospitals and A&E "
    "departments in Scotland, and I cannot give medical advice. For urgent medical help call "
    "NHS 24 on 111, or 999 in an emergency."
)

# -- rule-based parser (fake provider) -------------------------------------------------------
_ADVICE = re.compile(
    r"\b(medication|medicine|medicines|drug|drugs|pill|pills|tablet|tablets|dose|dosage|"
    r"symptom|symptoms|diagnos\w*|treat|treatment|cure|prescri\w*|side effects?|"
    r"should i take|can i take|how (?:do|can) i (?:treat|cure|stop|get rid)|"
    r"opening hours|open on|open at|waiting times?|how long)\b",
    re.IGNORECASE,
)

_CATEGORY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "ae",
        re.compile(
            r"(\ba\s*&\s*e\b|\ba and e\b|accident\s*(?:and|&)\s*emergency"
            r"|emergency (?:department|room)"
            r"|\bcasualty\b|\ber\b)",
            re.IGNORECASE,
        ),
    ),
    ("pharmacy", re.compile(r"\b(pharmac\w*|chemists?|dispensar\w*)\b", re.IGNORECASE)),
    ("dentist", re.compile(r"\b(dentists?|dental|dentistry)\b", re.IGNORECASE)),
    (
        "gp",
        re.compile(
            r"\b(gps?|doctors?|general practi\w*|surgery|surgeries|medical (?:centre|center)|"
            r"health (?:centre|center))\b",
            re.IGNORECASE,
        ),
    ),
    ("hospital", re.compile(r"\b(hospitals?|infirmary|infirmaries)\b", re.IGNORECASE)),
]

_NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "ten": 10}
_PREP = re.compile(
    r"\b(?:near|nearest to|closest to|close to|next to|around|in|to|from|at|by)\s+"
    r"(?P<place>[^?.!,;]+)",
    re.IGNORECASE,
)
_TRAILING = re.compile(
    r"\s+(?:please|now|tonight|today|tomorrow|thanks|thank you|open|that|which|with|for)\b.*$",
    re.IGNORECASE,
)
_HERE = {"me", "here", "my location", "my position", "my house", "my home", "where i am", "us"}
_PLURAL = re.compile(r"\b(gps|pharmacies|chemists|dentists|hospitals|doctors|surgeries)\b", re.I)


def detect_category(text: str) -> str | None:
    for cat, pat in _CATEGORY_PATTERNS:
        if pat.search(text):
            return cat
    return None


def detect_limit(text: str) -> int:
    m = re.search(
        r"\b(\d{1,2})\s+(?:nearest|closest|best)\b|\b(?:nearest|closest|top)\s+(\d{1,2})\b",
        text,
        re.I,
    )
    if m:
        return max(1, min(10, int(m.group(1) or m.group(2))))
    m = re.search(r"\b(one|two|three|four|five|six|ten)\s+(?:nearest|closest)\b", text, re.I)
    if m:
        return _NUMBER_WORDS[m.group(1).lower()]
    m = re.search(
        r"\b(\d{1,2})\s+(?:gps|pharmacies|dentists|hospitals|chemists|a\s*&\s*e)", text, re.I
    )
    if m:
        return max(1, min(10, int(m.group(1))))
    if _PLURAL.search(text):
        return 3
    return 1 if re.search(r"\b(?:nearest|closest)\b", text, re.I) else 3


def detect_place(text: str, resolver: PlaceResolver | None) -> str | None:
    pc = find_postcode(text)
    if pc:
        return pc
    if resolver is not None:
        known = resolver.gazetteer_match(text)
        if known:
            return known.title()
    last: str | None = None
    for m in _PREP.finditer(text):
        candidate = _TRAILING.sub("", m.group("place")).strip(" '\"")
        if candidate and candidate.lower() not in _HERE:
            last = candidate
    return last


def parse_question(question: str, resolver: PlaceResolver | None = None) -> Intent:
    """Deterministic stand-in for the intent LLM call."""
    if _ADVICE.search(question):
        return Intent(in_scope=False, category=None, place=None, limit=1)
    category = detect_category(question)
    if category is None:
        return Intent(in_scope=False, category=None, place=None, limit=1)
    return Intent(
        in_scope=True,
        category=category,  # type: ignore[arg-type]
        place=detect_place(question, resolver),
        limit=detect_limit(question),
    )


def intent_to_json(intent: Intent) -> str:
    return json.dumps(
        {
            "in_scope": intent.in_scope,
            "category": intent.category,
            "place": intent.place,
            "limit": intent.limit,
        }
    )


def parse_intent_json(text: str) -> Intent | None:
    """Parse the intent LLM reply; None when it is not usable JSON for the schema."""
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
        if isinstance(data.get("limit"), int):
            data["limit"] = max(1, min(10, data["limit"]))
        return Intent.model_validate(data)
    except (ValueError, TypeError):
        return None
