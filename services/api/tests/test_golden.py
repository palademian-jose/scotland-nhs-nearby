import json
import sys

from nhs_nearby.settings import REPO_ROOT

sys.path.insert(0, str(REPO_ROOT / "services" / "api" / "scripts"))

import eval as eval_script

GOLDEN = REPO_ROOT / "evals" / "golden" / "queries.jsonl"


def _cases():
    return [json.loads(x) for x in GOLDEN.read_text(encoding="utf-8").splitlines() if x.strip()]


def test_golden_set_shape():
    cases = _cases()
    assert len(cases) == 40
    assert len({c["id"] for c in cases}) == 40
    refusals = [c for c in cases if not c["expected"]["in_scope"]]
    assert len(refusals) >= 5
    for c in cases:
        assert {"id", "input", "expected", "failure_mode", "tags", "source"} <= set(c)
        if c["expected"]["top1_id"]:
            assert c["expected"]["top1_id"].split("-")[0] in {"gp", "ph", "dn", "ho", "ae"}


def test_eval_meets_gate_and_writes_contract_report(tmp_path):
    report = eval_script.run(tmp_path)
    assert (tmp_path / "eval.json").exists()
    assert report["provider"] == "fake" and report["label"] == "fake-provider"
    assert {"run_id", "commit", "timestamp", "provider", "model", "metrics", "cases"} <= set(report)
    assert eval_script.gate(report["metrics"], REPO_ROOT / "evals.yaml") == []
    # grounding is a hard property, not a tuned score
    assert report["metrics"]["grounded_rate"] == 1.0
    assert report["metrics"]["unknown_place_safe"] == 1.0
