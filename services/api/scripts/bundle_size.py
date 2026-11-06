"""Measure the web export in apps/mobile/dist and write reports/bundle.json."""

from __future__ import annotations

import gzip
import json
import sys

from nhs_nearby.settings import REPO_ROOT

DIST = REPO_ROOT / "apps" / "mobile" / "dist"


def main() -> int:
    if not DIST.exists():
        print("apps/mobile/dist not found: run `make web-build` first", file=sys.stderr)
        return 1
    files = [p for p in DIST.rglob("*") if p.is_file()]
    js = [p for p in files if p.suffix == ".js"]
    entry = max(js, key=lambda p: p.stat().st_size)
    data = entry.read_bytes()
    report = {
        "entry": entry.name,
        "js_kb": round(len(data) / 1024, 1),
        "js_gzip_kb": round(len(gzip.compress(data)) / 1024, 1),
        "dist_kb": round(sum(p.stat().st_size for p in files) / 1024, 1),
        "files": len(files),
    }
    out = REPO_ROOT / "reports" / "bundle.json"
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
