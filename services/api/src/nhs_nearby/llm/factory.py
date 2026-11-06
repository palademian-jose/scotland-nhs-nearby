"""Provider factory: explicit LLM_PROVIDER wins, else the first backend with a key, else fake."""

from __future__ import annotations

import logging

from nhs_nearby.llm.base import LLMClient
from nhs_nearby.llm.fake import FakeLLMClient
from nhs_nearby.settings import Settings, get_settings

log = logging.getLogger(__name__)


def get_client(settings: Settings | None = None, *, role: str = "generator") -> LLMClient:
    """Build the LLM client for ``role`` ("generator", "judge" or "cheap")."""
    settings = settings or get_settings()
    provider = settings.resolved_llm_provider()
    model = {
        "generator": settings.llm_model,
        "judge": settings.judge_model,
        "cheap": settings.cheap_model,
    }.get(role, settings.llm_model)

    if provider == "openrouter":
        if not settings.openrouter_api_key:
            raise RuntimeError("LLM_PROVIDER=openrouter but OPENROUTER_API_KEY is not set")
        from nhs_nearby.llm.openai_compat import OpenAICompatClient

        return OpenAICompatClient(
            settings.openrouter_api_key,
            provider="openrouter",
            default_model=model,
            base_url=settings.openrouter_base_url,
            site_url=settings.openrouter_site_url,
            app_name=settings.openrouter_app_name,
        )
    if provider == "anthropic":
        if not settings.anthropic_api_key:
            raise RuntimeError("LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set")
        from nhs_nearby.llm.anthropic_client import AnthropicClient

        return AnthropicClient(settings.anthropic_api_key, default_model=model)
    if provider == "openai":
        if not settings.openai_api_key:
            raise RuntimeError("LLM_PROVIDER=openai but OPENAI_API_KEY is not set")
        from nhs_nearby.llm.openai_compat import OpenAICompatClient

        return OpenAICompatClient(settings.openai_api_key, provider="openai", default_model=model)
    if settings.llm_provider is None:
        log.warning("No LLM API key found; using the deterministic fake provider.")
    return FakeLLMClient()
