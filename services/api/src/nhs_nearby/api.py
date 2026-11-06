"""FastAPI app: /health, /meta, /nearby, /resolve, /facility/{id}, POST /ask."""

from __future__ import annotations

import hashlib
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from nhs_nearby.ask import AskService, BudgetExceededError
from nhs_nearby.db import Database
from nhs_nearby.limits import DailyCostCap, RateLimiter
from nhs_nearby.llm.base import LLMClient
from nhs_nearby.llm.factory import get_client
from nhs_nearby.models import (
    CATEGORIES,
    AskRequest,
    AskResponse,
    Category,
    Facility,
    NearbyResponse,
)
from nhs_nearby.places import PlaceResolver
from nhs_nearby.settings import Settings, get_settings
from nhs_nearby.tracing import Tracer


def rate_limit(request: Request) -> str:
    """Per-IP token bucket. Returns a short hash of the client address for traces."""
    ip = request.client.host if request.client else "unknown"
    ok, retry = request.app.state.limiter.allow(ip)
    if not ok:
        raise HTTPException(
            status_code=429,
            detail="rate limit exceeded",
            headers={"Retry-After": str(int(retry) + 1)},
        )
    return hashlib.sha256(ip.encode()).hexdigest()[:12]


rate_limited = Annotated[str, Depends(rate_limit)]


def create_app(
    settings: Settings | None = None,
    *,
    llm: LLMClient | None = None,
    db: Database | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    database = db or Database.open(settings)
    resolver = PlaceResolver.from_files(
        settings.data_dir,
        live=settings.live_geocode,
        live_base_url=settings.postcodes_io_url,
    )
    client = llm or get_client(settings)
    if client.provider == "fake" and hasattr(client, "resolver"):
        client.resolver = resolver  # type: ignore[attr-defined]
    tracer = Tracer(settings.trace_path)
    cap = DailyCostCap(settings.daily_cost_cap_usd)
    limiter = RateLimiter(settings.rate_limit_per_minute, settings.rate_limit_burst)
    service = AskService(database, client, resolver, tracer, cap, model=settings.llm_model)

    app = FastAPI(title="scotland-nhs-nearby", version="0.1.0")
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["*"]
    )
    app.state.service = service
    app.state.db = database
    app.state.limiter = limiter
    app.state.cap = cap
    app.state.settings = settings

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "data": database.source, "llm_provider": client.provider}

    @app.get("/meta")
    def meta() -> dict:
        return {
            "source": database.source,
            "counts": database.counts(),
            "categories": list(CATEGORIES),
            "llm_provider": client.provider,
            "budget_remaining_usd": round(cap.remaining, 4),
        }

    @app.get("/nearby", response_model=NearbyResponse)
    def nearby(
        _ip: rate_limited,
        lat: Annotated[float, Query(ge=-90, le=90)],
        lon: Annotated[float, Query(ge=-180, le=180)],
        category: Category,
        limit: Annotated[int, Query(ge=1, le=50)] = 10,
    ) -> NearbyResponse:
        rows = database.nearby(lat, lon, category, limit)
        return NearbyResponse(category=category, lat=lat, lon=lon, count=len(rows), results=rows)

    @app.get("/resolve")
    def resolve(_ip: rate_limited, q: Annotated[str, Query(min_length=2, max_length=80)]) -> dict:
        place = resolver.resolve(q)
        if place is None:
            raise HTTPException(status_code=404, detail="place not found")
        return {"lat": place.lat, "lon": place.lon, "label": place.label, "via": place.via}

    @app.get("/facility/{facility_id}", response_model=Facility)
    def facility(_ip: rate_limited, facility_id: str) -> Facility:
        found = database.get(facility_id)
        if found is None:
            raise HTTPException(status_code=404, detail="facility not found")
        return found

    @app.post("/ask", response_model=AskResponse)
    def ask(body: AskRequest, ip: rate_limited) -> AskResponse:
        try:
            return service.ask(body, user_id=ip)
        except BudgetExceededError:
            raise HTTPException(status_code=429, detail="daily LLM budget reached") from None

    return app


def app_factory() -> FastAPI:
    """Entry point for ``uvicorn nhs_nearby.api:app_factory --factory``."""
    return create_app()
