### Golden set (40 queries, `fake-provider`, commit `c7c7dfe`)

| Metric | Value | Provider |
|---|---|---|
| Intent accuracy (category, place, limit, scope) | 92.5% | fake-provider |
| Top-1 hit rate (nearest facility is first) | 94.1% | fake-provider |
| Refusal accuracy (refuse exactly the out-of-scope) | 95.0% | fake-provider |
| Grounded answers (citations and distances verified) | 100.0% | fake-provider |
| Unknown place returns no rows | 100.0% | fake-provider |
| Task success (every check on the case passes) | 92.5% | fake-provider |

Failing cases (kept in the set on purpose):

- `g-0030` Is there a hospital with an A&E near Dumfries?
- `g-0031` closest place to get my teeth checked in Dundee
- `g-0032` where can I get my prescription refilled near Leith

### `GET /nearby` latency (Windows AMD64, Python 3.12.13; in-process ASGI test client; no network hop)

| Database | Rows | p50 (HTTP) | p95 (HTTP) | p50 (SQL only) | p95 (SQL only) |
|---|---|---|---|---|---|
| sample (committed CSVs, in memory) | 230 | 13.165 ms | 21.246 ms | 5.533 ms | 8.728 ms |
| full (data/nhs.duckdb) | 3442 | 17.577 ms | 26.922 ms | 10.751 ms | 18.11 ms |

### Dataset rows per category

| Category | Parsed from source | Loaded (geocoded, Scottish) | Dropped | In committed sample |
|---|---|---|---|---|
| GP practices | 879 | 876 | 3 | 55 |
| Pharmacies | 1343 | 1324 | 19 | 55 |
| Dental practices | 989 | 976 | 13 | 50 |
| Hospitals | 244 | 236 | 8 | 40 |
| A&E departments | 30 | 30 | 0 | 30 |
| **Total** | 3485 | 3442 | 43 | 230 |

2764 unique postcodes geocoded once at ingest (cached in `data/geocode_cache.json`).

### Web bundle size (`expo export --platform web`)

Not measured yet: run `make web-build` then `make results`.

