"""POST /ask: question -> intent (LLM) -> place -> nearest rows (SQL) -> grounded answer (LLM).

The answer is only ever a statement about the rows returned by the database. A verifier checks
that its citations and distances match those rows; a failed check swaps in the template answer.
"""

from __future__ import annotations

from nhs_nearby.answer import ParsedRow, format_facilities, render_answer, verify_answer
from nhs_nearby.db import Database
from nhs_nearby.intent import (
    ANSWER_SYSTEM,
    INTENT_SYSTEM,
    REFUSAL_MESSAGE,
    parse_intent_json,
    parse_question,
)
from nhs_nearby.limits import DailyCostCap
from nhs_nearby.llm.base import LLMClient, LLMResponse, Message
from nhs_nearby.models import (
    CATEGORIES,
    AskRequest,
    AskResponse,
    Citation,
    Intent,
    NearbyResult,
)
from nhs_nearby.places import PlaceResolver
from nhs_nearby.tracing import Tracer, price_cost

NOT_FOUND_TEMPLATE = (
    "I could not find '{place}'. Try a full postcode such as EH8 9YL, or the name of a "
    "Scottish town or area."
)
NEED_LOCATION = (
    "Tell me where to search from: add a postcode or a town to your question, "
    "or share your location."
)


class BudgetExceededError(Exception):
    """The daily LLM spend cap is used up."""


class AskService:
    def __init__(
        self,
        db: Database,
        llm: LLMClient,
        resolver: PlaceResolver,
        tracer: Tracer,
        cap: DailyCostCap,
        *,
        model: str | None = None,
    ) -> None:
        self.db = db
        self.llm = llm
        self.resolver = resolver
        self.tracer = tracer
        self.cap = cap
        self.model = model

    # -- LLM call with tracing and cost ------------------------------------------------------
    def _complete(
        self, name: str, system: str, user: str, trace_id: str, parent: str, user_id: str
    ) -> LLMResponse:
        with self.tracer.span(
            name, kind="llm", trace_id=trace_id, parent=parent, user_id=user_id, model=self.model
        ) as rec:
            resp = self.llm.complete(
                [Message(role="system", content=system), Message(role="user", content=user)],
                model=self.model,
                max_tokens=300,
            )
            if resp.cost_usd is not None:
                cost = resp.cost_usd
            else:
                cost = price_cost(resp.model, resp.usage.input_tokens, resp.usage.output_tokens)
            rec.update(
                model=resp.model,
                input_tokens=resp.usage.input_tokens,
                output_tokens=resp.usage.output_tokens,
                cost_usd=round(cost, 8),
            )
            rec["meta"]["provider"] = self.llm.provider
            self.cap.record(cost)
        return resp

    def _intent(self, question: str, trace_id: str, parent: str, user_id: str) -> Intent:
        resp = self._complete(
            "parse_intent", INTENT_SYSTEM, f"QUESTION: {question}", trace_id, parent, user_id
        )
        intent = parse_intent_json(resp.text)
        if intent is None:  # malformed model output: fall back to the rule parser
            intent = parse_question(question, self.resolver)
        if intent.category is None or intent.category not in CATEGORIES:
            return intent.model_copy(update={"in_scope": False, "category": None})
        return intent

    # -- main entry ---------------------------------------------------------------------------
    def ask(self, req: AskRequest, user_id: str = "anon") -> AskResponse:
        if not self.cap.allow():
            raise BudgetExceededError
        trace_id = self.tracer.new_trace()
        with self.tracer.span("ask", trace_id=trace_id, user_id=user_id) as root:
            root_id = root["span_id"]
            intent = self._intent(req.question, trace_id, root_id, user_id)
            if not intent.in_scope or intent.category is None:
                root["meta"]["outcome"] = "refused"
                return AskResponse(
                    answer=REFUSAL_MESSAGE, refused=True, intent=intent, results=[], citations=[]
                )

            lat = lon = 0.0
            label = ""
            via = "none"
            found = False
            with self.tracer.span(
                "resolve_place", trace_id=trace_id, parent=root_id, user_id=user_id
            ) as rp:
                if intent.place:
                    resolved = self.resolver.resolve(intent.place)
                    if resolved:
                        lat, lon, label, via = (
                            resolved.lat,
                            resolved.lon,
                            resolved.label,
                            resolved.via,
                        )
                        found = True
                elif req.lat is not None and req.lon is not None:
                    lat, lon, label, via, found = (
                        req.lat,
                        req.lon,
                        "your location",
                        "coordinates",
                        True,
                    )
                rp["meta"]["via"] = via

            if not found:
                root["meta"]["outcome"] = "no_place"
                msg = (
                    NOT_FOUND_TEMPLATE.format(place=intent.place) if intent.place else NEED_LOCATION
                )
                return AskResponse(
                    answer=msg, refused=False, intent=intent, results=[], citations=[]
                )

            with self.tracer.span(
                "nearby_query",
                kind="retrieval",
                trace_id=trace_id,
                parent=root_id,
                user_id=user_id,
            ) as q:
                rows = self.db.nearby(lat, lon, intent.category, intent.limit)
                q["meta"]["rows"] = len(rows)

            answer = self._answer(req.question, intent, label, rows, trace_id, root_id, user_id)
            root["meta"]["outcome"] = "answered"
        return AskResponse(
            answer=answer,
            refused=False,
            intent=intent,
            resolved_place=label,
            resolved_via=via,  # type: ignore[arg-type]
            results=rows,
            citations=[
                Citation(
                    index=i, id=r.id, name=r.name, postcode=r.postcode, distance_km=r.distance_km
                )
                for i, r in enumerate(rows, start=1)
            ],
        )

    def _answer(
        self,
        question: str,
        intent: Intent,
        label: str,
        rows: list[NearbyResult],
        trace_id: str,
        parent: str,
        user_id: str,
    ) -> str:
        assert intent.category is not None
        user = (
            f"QUESTION: {question}\nCATEGORY: {intent.category}\nLOCATION: {label}\n"
            f"FACILITIES:\n{format_facilities(rows) or '(none)'}"
        )
        resp = self._complete("compose_answer", ANSWER_SYSTEM, user, trace_id, parent, user_id)
        with self.tracer.span("verify", kind="verify", trace_id=trace_id, parent=parent) as v:
            ok, reason = verify_answer(resp.text, rows)
            v["meta"].update(ok=ok, reason=reason)
            if ok:
                return resp.text.strip()
            parsed = [
                ParsedRow(i, r.name, r.postcode, f"{r.distance_km:.1f} km")
                for i, r in enumerate(rows, start=1)
            ]
            return render_answer(intent.category, label, parsed)
