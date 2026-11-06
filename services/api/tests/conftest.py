"""Shared fixtures. Tests never touch the network: the committed sample CSVs back every test."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from nhs_nearby.api import create_app
from nhs_nearby.db import Database
from nhs_nearby.settings import REPO_ROOT, Settings

DATA_DIR = REPO_ROOT / "data"


@pytest.fixture(scope="session")
def sample_db() -> Database:
    return Database.from_csv_dir(DATA_DIR / "sample")


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        llm_provider="fake",
        use_sample=True,
        data_dir=DATA_DIR,
        trace_path=tmp_path / "spans.jsonl",
        rate_limit_per_minute=600,
        rate_limit_burst=100,
    )


@pytest.fixture
def client(settings: Settings, sample_db: Database) -> TestClient:
    return TestClient(create_app(settings, db=sample_db))
