import httpx
import pytest

from nhs_nearby.intent import parse_intent_json, parse_question
from nhs_nearby.places import PlaceResolver
from nhs_nearby.settings import REPO_ROOT

DATA = REPO_ROOT / "data"


@pytest.fixture(scope="module")
def resolver() -> PlaceResolver:
    return PlaceResolver.from_files(DATA)


def test_cached_postcode_resolves_exactly(resolver):
    # Any postcode that backs an NHS site is in the committed cache.
    pc = next(iter(resolver.cache))
    got = resolver.resolve(f"near {pc.lower().replace(' ', '')}")
    assert got is not None and got.via == "postcode"
    assert [got.lat, got.lon] == resolver.cache[pc]


def test_unknown_postcode_falls_back_to_district_centroid(resolver):
    got = resolver.resolve("EH8 0ZZ")
    assert got is not None and got.via == "postcode_district"
    assert 55.8 < got.lat < 56.1


def test_unknown_district_is_none(resolver):
    assert resolver.resolve("ZZ99 9ZZ") is None


def test_gazetteer_exact_and_embedded(resolver):
    assert resolver.resolve("Partick").via == "gazetteer"
    assert resolver.resolve("the Leith area").label == "Leith"
    assert resolver.resolve("Atlantis") is None


def test_live_lookup_used_only_when_enabled_and_never_raises():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("EH8%209YL") or request.url.path.endswith("EH8 9YL"):
            return httpx.Response(200, json={"result": {"latitude": 55.94, "longitude": -3.17}})
        return httpx.Response(404, json={"error": "not found"})

    http = httpx.Client(transport=httpx.MockTransport(handler))
    off = PlaceResolver({}, {}, live=False, http=http)
    assert off.resolve("EH8 9YL") is None
    on = PlaceResolver({}, {}, live=True, http=http)
    hit = on.resolve("EH8 9YL")
    assert hit is not None and hit.via == "live_postcode"
    assert on.resolve("G1 1AA") is None

    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    down = PlaceResolver({}, {}, live=True, http=httpx.Client(transport=httpx.MockTransport(boom)))
    assert down.resolve("EH8 9YL") is None


@pytest.mark.parametrize(
    ("question", "category", "place", "limit"),
    [
        ("nearest pharmacy to EH8 9YL", "pharmacy", "EH8 9YL", 1),
        ("Where is the closest A&E to Partick?", "ae", "Partick", 1),
        ("3 nearest dentists in Aberdeen", "dentist", "Aberdeen", 3),
        ("find me a GP near Leith", "gp", "Leith", 3),
        ("which hospital is nearest to Inverness", "hospital", "Inverness", 1),
        ("two closest chemists around Dundee", "pharmacy", "Dundee", 2),
        ("accident and emergency near g51 4tf", "ae", "G51 4TF", 3),
    ],
)
def test_rule_parser(resolver, question, category, place, limit):
    intent = parse_question(question, resolver)
    assert intent.in_scope
    assert (intent.category, intent.place, intent.limit) == (category, place, limit)


@pytest.mark.parametrize(
    "question",
    [
        "what medication should I take for a headache",
        "how do I treat a sprained ankle",
        "what is the capital of Scotland",
        "is the Boots in Leith open on Sunday",
    ],
)
def test_out_of_scope_questions(resolver, question):
    intent = parse_question(question, resolver)
    assert not intent.in_scope and intent.category is None


def test_parse_intent_json_tolerates_prose_and_rejects_garbage():
    ok = parse_intent_json(
        'Sure! {"in_scope": true, "category": "gp", "place": "Leith", "limit": 99}'
    )
    assert ok is not None and ok.limit == 10
    assert parse_intent_json("no json here") is None
    assert parse_intent_json('{"category": "veterinary"}') is None
