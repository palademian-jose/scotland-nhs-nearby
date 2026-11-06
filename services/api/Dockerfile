# Build from the repository root so the committed data/ is in the context:
#   docker build -f services/api/Dockerfile -t nhs-nearby-api .
# ---- build stage: resolve and install dependencies with uv --------------------------------
FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

COPY services/api/pyproject.toml services/api/uv.lock services/api/.python-version services/api/README.md ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev --no-editable

COPY services/api/src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable

# ---- runtime stage: virtualenv plus the committed data only --------------------------------
FROM python:3.12-slim AS runtime

RUN useradd --create-home --uid 1000 app
WORKDIR /app

COPY --from=builder --chown=app:app /app/.venv /app/.venv
COPY --chown=app:app data/sample ./data/sample
COPY --chown=app:app data/geocode_cache.json data/gazetteer.json ./data/

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/app/data \
    TRACE_PATH=/app/traces/spans.jsonl

RUN mkdir -p /app/traces && chown -R app:app /app/traces
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status == 200 else 1)"

CMD ["uvicorn", "nhs_nearby.api:app_factory", "--factory", "--host", "0.0.0.0", "--port", "8000"]
