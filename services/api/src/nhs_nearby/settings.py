"""Single source of configuration, read from the environment and an optional .env file."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

LLMProvider = Literal["fake", "openrouter", "anthropic", "openai"]

# services/api/src/nhs_nearby/settings.py -> repository root
REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Providers. ``llm_provider`` left unset means "auto": openrouter > anthropic > openai > fake.
    llm_provider: LLMProvider | None = None
    llm_model: str = "anthropic/claude-sonnet-5.5"
    judge_model: str = "openai/gpt-5.4-mini"
    cheap_model: str = "anthropic/claude-haiku-5.5"
    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_site_url: str | None = None
    openrouter_app_name: str = "scotland-nhs-nearby"
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None

    # Data
    data_dir: Path = REPO_ROOT / "data"
    db_path: Path | None = None  # default: <data_dir>/nhs.duckdb, else the committed sample
    use_sample: bool = False  # force the committed sample CSVs (in-memory database)
    live_geocode: bool = False  # allow a live postcodes.io lookup for postcodes not in the cache
    postcodes_io_url: str = "https://api.postcodes.io"

    # Cost / limits
    daily_cost_cap_usd: float = 2.0
    rate_limit_per_minute: int = 60
    rate_limit_burst: int = 20

    cors_origins: str = "*"  # comma-separated; the data is public and the API holds no sessions

    # Tracing
    trace_path: Path = Path("traces/spans.jsonl")
    pricing_path: Path | None = None

    def has_key(self, provider: str) -> bool:
        return {
            "openrouter": bool(self.openrouter_api_key),
            "anthropic": bool(self.anthropic_api_key),
            "openai": bool(self.openai_api_key),
        }.get(provider, False)

    def resolved_llm_provider(self) -> LLMProvider:
        """Explicit LLM_PROVIDER wins; otherwise pick the first backend that has a key."""
        if self.llm_provider is not None:
            return self.llm_provider
        for candidate in ("openrouter", "anthropic", "openai"):
            if self.has_key(candidate):
                return candidate  # type: ignore[return-value]
        return "fake"


@lru_cache
def get_settings() -> Settings:
    return Settings()
