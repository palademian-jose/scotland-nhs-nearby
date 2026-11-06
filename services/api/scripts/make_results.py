"""Build reports/results.md from the JSON reports and splice it into README.md.

Inputs (all produced by scripts in this repo): reports/eval.json (scripts/eval.py),
reports/bench.json (scripts/bench.py), reports/ingest.json (nhs-ingest build),
reports/bundle.json (scripts/bundle_size.py, optional). Nothing here is typed by hand.
"""

from __future__ import annotations

import json

from nhs_nearby.settings import REPO_ROOT

REPORTS = REPO_ROOT / "reports"
START, END = "<!-- results:start -->", "<!-- results:end -->"
LABELS = {
    "gp": "GP practices",
    "pharmacy": "Pharmacies",
    "dentist": "Dental practices",
    "hospital": "Hospitals",
    "ae": "A&E departments",
}


def _load(name: str) -> dict | None:
    p = REPORTS / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def _pct(v: float | None) -> str:
    return "n/a" if v is None else f"{v * 100:.1f}%"


def build() -> str:
    ev, bench, ingest, bundle = (
        _load("eval.json"),
        _load("bench.json"),
        _load("ingest.json"),
        _load("bundle.json"),
    )
    out: list[str] = []
    if ev:
        m = ev["metrics"]
        out += [
            f"### Golden set ({ev['n_cases']} queries, `fake-provider`, commit `{ev['commit']}`)",
            "",
            "| Metric | Value | Provider |",
            "|---|---|---|",
            f"| Intent accuracy (category, place, limit, scope) | {_pct(m['intent_accuracy'])} | fake-provider |",
            f"| Top-1 hit rate (nearest facility is first) | {_pct(m['top1_hit_rate'])} | fake-provider |",
            f"| Refusal accuracy (refuse exactly the out-of-scope) | {_pct(m['refusal_accuracy'])} | fake-provider |",
            f"| Grounded answers (citations and distances verified) | {_pct(m['grounded_rate'])} | fake-provider |",
            f"| Unknown place returns no rows | {_pct(m['unknown_place_safe'])} | fake-provider |",
            f"| Task success (every check on the case passes) | {_pct(m['task_success'])} | fake-provider |",
            "",
        ]
        failed = [c for c in ev["cases"] if not c["passed"]]
        if failed:
            out += ["Failing cases (kept in the set on purpose):", ""]
            out += [f"- `{c['id']}` {c['question']}" for c in failed]
            out.append("")
    if bench:
        out += [
            f"### `GET /nearby` latency ({bench['machine']}; {bench['note']})",
            "",
            "| Database | Rows | p50 (HTTP) | p95 (HTTP) | p50 (SQL only) | p95 (SQL only) |",
            "|---|---|---|---|---|---|",
        ]
        for r in bench["runs"]:
            out.append(
                f"| {r['database']} | {r['rows']} | {r['http_p50_ms']} ms | {r['http_p95_ms']} ms "
                f"| {r['sql_p50_ms']} ms | {r['sql_p95_ms']} ms |"
            )
        out.append("")
    if ingest:
        out += [
            "### Dataset rows per category",
            "",
            "| Category | Parsed from source | Loaded (geocoded, Scottish) | Dropped | In committed sample |",
            "|---|---|---|---|---|",
        ]
        for cat, label in LABELS.items():
            dropped = ingest["dropped_no_coordinates_or_not_scottish"].get(cat, 0)
            out.append(
                f"| {label} | {ingest['parsed_rows'].get(cat, 0)} | {ingest['loaded_rows'].get(cat, 0)} "
                f"| {dropped} | {ingest['sample_rows'].get(cat, 0)} |"
            )
        out += [
            f"| **Total** | {sum(ingest['parsed_rows'].values())} | {sum(ingest['loaded_rows'].values())} "
            f"| {sum(ingest['dropped_no_coordinates_or_not_scottish'].values())} "
            f"| {sum(ingest['sample_rows'].values())} |",
            "",
            f"{ingest['unique_postcodes']} unique postcodes geocoded once at ingest (cached in `data/geocode_cache.json`).",
            "",
        ]
    out += ["### Web bundle size (`expo export --platform web`)", ""]
    if bundle:
        out += [
            "| Artifact | Size |",
            "|---|---|",
            f"| Entry JavaScript (minified) | {bundle['js_kb']} KB ({bundle['js_gzip_kb']} KB gzip) |",
            f"| Whole `dist/` directory | {bundle['dist_kb']} KB across {bundle['files']} files |",
            "",
        ]
    else:
        out += ["Not measured yet: run `make web-build` then `make results`.", ""]
    return "\n".join(out)


def main() -> None:
    text = build()
    (REPORTS / "results.md").write_text(text + "\n", encoding="utf-8")
    readme = REPO_ROOT / "README.md"
    if readme.exists():
        body = readme.read_text(encoding="utf-8")
        if START in body and END in body:
            head, rest = body.split(START, 1)
            _, tail = rest.split(END, 1)
            readme.write_text(f"{head}{START}\n{text}\n{END}{tail}", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
