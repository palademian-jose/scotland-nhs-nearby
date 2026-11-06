.PHONY: setup test test-api test-app lint lint-api lint-app typecheck demo serve app ingest download eval bench golden results web-build web-serve screenshots clean

UV ?= uv
API := services/api
APP := apps/mobile
PORT ?= 8000

setup:            ## install Python 3.12 toolchain, API deps and the app's npm deps
	cd $(API) && $(UV) python install 3.12 && $(UV) sync
	cd $(APP) && npm ci
	@test -f .env || cp .env.example .env

test: test-api test-app   ## run both test suites with the fake provider

test-api:
	cd $(API) && LLM_PROVIDER=fake $(UV) run pytest

test-app:
	cd $(APP) && npm test

lint: lint-api lint-app   ## ruff + eslint + prettier checks

lint-api:
	cd $(API) && $(UV) run ruff check src tests scripts
	cd $(API) && $(UV) run ruff format --check src tests scripts

lint-app:
	cd $(APP) && npm run lint

typecheck:        ## tsc --noEmit for the app
	cd $(APP) && npm run typecheck

demo:             ## offline demo: sample data, fake provider, no network
	cd $(API) && LLM_PROVIDER=fake $(UV) run python scripts/demo.py

serve:            ## API on http://localhost:$(PORT) (built database if present, else the sample)
	cd $(API) && $(UV) run uvicorn nhs_nearby.api:app_factory --factory --host 0.0.0.0 --port $(PORT)

app:              ## Expo dev server (press w for web)
	cd $(APP) && npx expo start

download:         ## fetch the five NHS Scotland CSVs into data/raw/
	cd $(API) && $(UV) run nhs-ingest download

ingest:           ## raw CSVs -> data/nhs.duckdb + data/sample/*.csv (uses data/geocode_cache.json)
	cd $(API) && $(UV) run nhs-ingest build --report ../../reports/ingest.json

golden:           ## regenerate evals/golden/queries.jsonl from the hand-written cases
	cd $(API) && $(UV) run python scripts/build_golden.py

eval:             ## score the golden set (fake provider) -> reports/eval.json, gated by evals.yaml
	cd $(API) && LLM_PROVIDER=fake $(UV) run python scripts/eval.py --gate ../../evals.yaml

bench:            ## /nearby latency -> reports/bench.json
	cd $(API) && $(UV) run python scripts/bench.py --full

web-build:        ## expo export --platform web, then measure the bundle
	cd $(APP) && npx expo export --platform web
	cd $(API) && $(UV) run python scripts/bundle_size.py

web-serve:        ## serve the web export on http://localhost:8081
	cd $(APP) && npx serve dist -l 8081

results:          ## rebuild reports/results.md and the README results block from reports/*.json
	cd $(API) && $(UV) run python scripts/make_results.py

screenshots:      ## headless Playwright screenshots of the web export -> docs/*.png
	cd $(APP) && npm run screenshots

clean:
	rm -rf $(APP)/dist $(API)/.pytest_cache $(API)/.ruff_cache data/nhs.duckdb
