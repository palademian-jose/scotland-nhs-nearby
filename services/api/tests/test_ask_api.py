import json

from fastapi.testclient import TestClient

from nhs_nearby.answer import verify_answer
from nhs_nearby.api import create_app
from nhs_nearby.ask import AskService
from nhs_nearby.intent import REFUSAL_MESSAGE
from nhs_nearby.limits import DailyCostCap
from nhs_nearby.llm.fake import FakeLLMClient
from nhs_nearby.models import AskRequest
from nhs_nearby.places import PlaceResolver
from nhs_nearby.settings import REPO_ROOT, Settings
from nhs_nearby.tracing import Tracer, read_spans


def _service(sample_db, responses=None, cap=None, trace=None):
    resolver = PlaceResolver.from_files(REPO_ROOT / "data")
    llm = FakeLLMClient(responses, resolver=resolver)
    return AskService(
        sample_db, llm, resolver, Tracer(trace), cap or DailyCostCap(5.0), model="fake-rules-v1"
    )


# -- /nearby ----------------------------------------------------------------------------------
def test_nearby_returns_sorted_rows_with_provenance(client):
    r = client.get("/nearby", params={"lat": 55.95, "lon": -3.19, "category": "gp", "limit": 4})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 4
    d = [x["distance_km"] for x in body["results"]]
    assert d == sorted(d)
    first = body["results"][0]
    for key in ("name", "address", "postcode", "category", "health_board", "source_dataset"):
        assert first[key]


def test_nearby_validates_input(client):
    assert client.get("/nearby", params={"lat": 91, "lon": 0, "category": "gp"}).status_code == 422
    bad = client.get("/nearby", params={"lat": 55, "lon": -3, "category": "vet"})
    assert bad.status_code == 422
    assert (
        client.get(
            "/nearby", params={"lat": 55, "lon": -3, "category": "gp", "limit": 0}
        ).status_code
        == 422
    )


def test_resolve_and_facility_and_meta(client):
    assert client.get("/resolve", params={"q": "Leith"}).json()["via"] == "gazetteer"
    assert client.get("/resolve", params={"q": "Atlantis"}).status_code == 404
    first = client.get("/nearby", params={"lat": 55.95, "lon": -3.19, "category": "ae"}).json()
    fid = first["results"][0]["id"]
    assert client.get(f"/facility/{fid}").json()["id"] == fid
    assert client.get("/facility/none").status_code == 404
    assert client.get("/meta").json()["llm_provider"] == "fake"
    assert client.get("/health").json()["status"] == "ok"


# -- /ask -------------------------------------------------------------------------------------
def test_ask_grounds_answer_in_rows_and_cites_them(client):
    r = client.post("/ask", json={"question": "3 nearest dentists in Aberdeen"})
    body = r.json()
    assert r.status_code == 200 and not body["refused"]
    assert len(body["results"]) == 3 == len(body["citations"])
    for c, row in zip(body["citations"], body["results"], strict=True):
        assert c["id"] == row["id"]
        assert row["name"] in body["answer"]
        assert f"[{c['index']}]" in body["answer"]


def test_ask_uses_coordinates_when_no_place(client):
    r = client.post("/ask", json={"question": "nearest hospital", "lat": 57.15, "lon": -2.09})
    body = r.json()
    assert body["resolved_via"] == "coordinates" and len(body["results"]) == 1


def test_ask_without_any_location_asks_for_one(client):
    body = client.post("/ask", json={"question": "nearest hospital"}).json()
    assert not body["refused"] and body["results"] == []
    assert "postcode" in body["answer"]


def test_ask_unknown_place_does_not_guess(client):
    body = client.post("/ask", json={"question": "closest GP near Atlantis"}).json()
    assert body["results"] == [] and "Atlantis" in body["answer"]


def test_ask_refuses_out_of_scope_with_fixed_message(client):
    body = client.post("/ask", json={"question": "what medication should I take for a cold"}).json()
    assert body["refused"] and body["answer"] == REFUSAL_MESSAGE and body["results"] == []


def test_ask_rejects_bad_payloads(client):
    assert client.post("/ask", json={"question": ""}).status_code == 422
    assert client.post("/ask", json={"question": "x" * 501}).status_code == 422
    assert client.post("/ask", json={"question": "gp", "lat": 200, "lon": 0}).status_code == 422


def test_hallucinated_citation_is_replaced_by_template_answer(sample_db):
    bad_answer = "Try the Royal Fictional Pharmacy, 0.1 km away [7]."
    intent = '{"in_scope": true, "category": "pharmacy", "place": "Leith", "limit": 2}'
    svc = _service(sample_db, [intent, bad_answer])
    resp = svc.ask(AskRequest(question="pharmacies in Leith"))
    assert "Fictional" not in resp.answer
    ok, _ = verify_answer(resp.answer, resp.results)
    assert ok and len(resp.results) == 2


def test_wrong_distance_in_answer_fails_verification(sample_db):
    rows = sample_db.nearby(55.976, -3.17, "gp", 1)
    good = f"{rows[0].name} [1] is {rows[0].distance_km:.1f} km away."
    assert verify_answer(good, rows)[0]
    assert not verify_answer(good.replace(f"{rows[0].distance_km:.1f}", "0.0"), rows)[0]
    assert not verify_answer("No citation at all.", rows)[0]


def test_malformed_intent_json_falls_back_to_rules(sample_db):
    svc = _service(sample_db, ["I think it is a pharmacy, sorry!"])
    resp = svc.ask(AskRequest(question="nearest pharmacy to Leith"))
    assert resp.intent.category == "pharmacy" and len(resp.results) == 1


def test_model_cannot_invent_a_category(sample_db):
    svc = _service(
        sample_db, ['{"in_scope": true, "category": "vet", "place": "Leith", "limit": 1}']
    )
    resp = svc.ask(AskRequest(question="nearest vet to Leith"))
    assert resp.refused


def test_daily_cost_cap_blocks_requests(settings, sample_db):
    cap_app = create_app(settings.model_copy(update={"daily_cost_cap_usd": 0.0}), db=sample_db)
    r = TestClient(cap_app).post("/ask", json={"question": "nearest gp to Leith"})
    assert r.status_code == 429 and "budget" in r.json()["detail"]


def test_rate_limit_returns_429_with_retry_after(sample_db, settings):
    tight = settings.model_copy(update={"rate_limit_per_minute": 1, "rate_limit_burst": 2})
    c = TestClient(create_app(tight, db=sample_db))
    params = {"lat": 55.9, "lon": -3.2, "category": "gp"}
    seen = [c.get("/nearby", params=params) for _ in range(4)]
    assert [r.status_code for r in seen] == [200, 200, 429, 429]
    assert int(seen[2].headers["retry-after"]) >= 1


def test_trace_spans_follow_shared_schema(tmp_path, sample_db):
    path = tmp_path / "spans.jsonl"
    svc = _service(sample_db, trace=path)
    svc.ask(AskRequest(question="nearest pharmacy to Leith"))
    spans = read_spans(path)
    names = [s["name"] for s in spans]
    assert {
        "ask",
        "parse_intent",
        "resolve_place",
        "nearby_query",
        "compose_answer",
        "verify",
    } <= set(names)
    required = {
        "trace_id",
        "span_id",
        "parent_span_id",
        "name",
        "kind",
        "start_ts",
        "end_ts",
        "latency_ms",
        "model",
        "input_tokens",
        "output_tokens",
        "cost_usd",
        "cache_hit",
        "feature",
        "user_id",
        "session_id",
        "status",
        "error_kind",
        "meta",
    }
    for s in spans:
        assert required == set(s)
        json.dumps(s)
    assert len({s["trace_id"] for s in spans}) == 1
    llm = [s for s in spans if s["kind"] == "llm"]
    assert len(llm) == 2 and all(s["model"] == "fake-rules-v1" and s["cost_usd"] == 0 for s in llm)
    root = next(s for s in spans if s["name"] == "ask")
    assert root["parent_span_id"] is None and root["meta"]["outcome"] == "answered"


def test_settings_default_to_fake_without_keys(monkeypatch):
    from nhs_nearby.llm.factory import get_client

    for k in ("OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "LLM_PROVIDER"):
        monkeypatch.delenv(k, raising=False)
    s = Settings(_env_file=None)
    assert s.resolved_llm_provider() == "fake"
    assert get_client(s).provider == "fake"
    assert Settings(_env_file=None, openrouter_api_key="k").resolved_llm_provider() == "openrouter"
