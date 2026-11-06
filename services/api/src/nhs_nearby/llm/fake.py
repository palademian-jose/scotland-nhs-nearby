"""Deterministic fake LLM backend: rules, no network, no randomness.

It answers the two prompts this app sends (see ``nhs_nearby.intent``): the intent call is a
rule-based parser, the answer call is a template over the numbered facility list. Scripted
responses (a queue) let tests inject malformed or hostile model output.
"""

from __future__ import annotations

import time
from collections import deque

from nhs_nearby.answer import parse_facilities, render_answer
from nhs_nearby.intent import ANSWER_MARKER, INTENT_MARKER, intent_to_json, parse_question
from nhs_nearby.llm.base import LLMResponse, Message, ToolSpec, Usage, approx_tokens
from nhs_nearby.places import PlaceResolver

FAKE_MODEL = "fake-rules-v1"


class FakeLLMClient:
    provider = "fake"

    def __init__(
        self, responses: list[str] | None = None, *, resolver: PlaceResolver | None = None
    ) -> None:
        self._queue: deque[str] = deque(responses or [])
        self.resolver = resolver
        self.model = FAKE_MODEL
        self.calls: list[list[Message]] = []

    def complete(
        self,
        messages: list[Message],
        *,
        tools: list[ToolSpec] | None = None,
        model: str | None = None,
        temperature: float = 0.0,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        start = time.perf_counter()
        self.calls.append(messages)
        system = "\n".join(m.text() for m in messages if m.role == "system")
        user = "\n".join(m.text() for m in messages if m.role == "user")
        if self._queue:
            text = self._queue.popleft()
        elif INTENT_MARKER in system:
            question = user.removeprefix("QUESTION:").strip()
            text = intent_to_json(parse_question(question, self.resolver))
        elif ANSWER_MARKER in system:
            text = self._answer(user)
        else:
            text = f"[fake] {user[:200]}"
        return LLMResponse(
            text=text,
            usage=Usage(
                input_tokens=approx_tokens(system + user), output_tokens=approx_tokens(text)
            ),
            model=self.model,
            latency_ms=(time.perf_counter() - start) * 1000,
        )

    @staticmethod
    def _answer(user: str) -> str:
        fields: dict[str, str] = {}
        for line in user.splitlines():
            for key in ("CATEGORY", "LOCATION"):
                if line.startswith(f"{key}:"):
                    fields[key] = line.split(":", 1)[1].strip()
        return render_answer(
            fields.get("CATEGORY", "gp"),
            fields.get("LOCATION", "your location"),
            parse_facilities(user),
        )
