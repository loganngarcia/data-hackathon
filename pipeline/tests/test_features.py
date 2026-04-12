"""Tests for feature engineering pipeline."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import pyarrow as pa
import pyarrow.parquet as pq

PIPELINE_SRC = Path(__file__).resolve().parents[1] / "src"
if str(PIPELINE_SRC) not in sys.path:
    sys.path.insert(0, str(PIPELINE_SRC))

from hackathon_pipeline.features import (
    build_features,
    compute_features,
    compute_peer_features,
)


def _make_org_year_row(**overrides: object) -> dict:
    base = {
        "ein": "123456789",
        "organization_name": "TEST ORG",
        "tax_year": "2020",
        "state": "CA",
        "city": "TESTVILLE",
        "total_revenue": 1_000_000,
        "total_expenses": 900_000,
        "contributions_grants": 600_000,
        "program_service_revenue": 300_000,
        "investment_income": 50_000,
        "other_revenue": 50_000,
        "program_expenses": 750_000,
        "total_assets_eoy": 2_000_000,
        "total_liabilities_eoy": 500_000,
        "net_assets_eoy": 1_500_000,
        "total_employee_count": 20,
        "gross_receipts": 1_000_000,
    }
    base.update(overrides)
    return base


class TestComputeFeatures(unittest.TestCase):

    def test_single_year_produces_ratios(self) -> None:
        rows = [_make_org_year_row()]
        features = compute_features(rows)
        self.assertEqual(len(features), 1)
        f = features[0]
        self.assertAlmostEqual(f["operating_margin"], 0.1, places=2)
        self.assertAlmostEqual(f["program_expense_ratio"], 750_000 / 900_000, places=2)
        self.assertAlmostEqual(f["months_of_reserve"], 1_500_000 / (900_000 / 12), places=1)
        self.assertEqual(f["size_band"], "small")
        self.assertIsNone(f["revenue_growth_yoy"])  # no prior year

    def test_multi_year_produces_growth(self) -> None:
        rows = [
            _make_org_year_row(tax_year="2019", total_revenue=800_000, total_expenses=700_000,
                               net_assets_eoy=1_000_000, total_employee_count=18),
            _make_org_year_row(tax_year="2020", total_revenue=1_000_000, total_expenses=900_000,
                               net_assets_eoy=1_500_000, total_employee_count=20),
        ]
        features = compute_features(rows)
        self.assertEqual(len(features), 2)
        f2020 = features[1]
        self.assertAlmostEqual(f2020["revenue_growth_yoy"], 0.25, places=2)
        self.assertAlmostEqual(f2020["net_asset_change_yoy"], 0.5, places=2)

    def test_revenue_hhi_computed(self) -> None:
        rows = [_make_org_year_row()]
        features = compute_features(rows)
        hhi = features[0]["revenue_hhi"]
        self.assertIsNotNone(hhi)
        self.assertGreater(hhi, 0.25)  # can't be below uniform
        self.assertLessEqual(hhi, 1.0)

    def test_years_of_data_tracked(self) -> None:
        rows = [
            _make_org_year_row(tax_year=str(y))
            for y in range(2018, 2021)
        ]
        features = compute_features(rows)
        for f in features:
            self.assertEqual(f["years_of_data"], 3)


class TestPeerFeatures(unittest.TestCase):

    def test_peer_percentiles_computed(self) -> None:
        rows = [
            _make_org_year_row(ein="A", total_revenue=500_000, state="CA"),
            _make_org_year_row(ein="B", total_revenue=800_000, state="CA"),
            _make_org_year_row(ein="C", total_revenue=1_200_000, state="CA"),
        ]
        features = compute_features(rows)
        features = compute_peer_features(features)
        for f in features:
            self.assertIsNotNone(f.get("margin_pctile_peer"))
            self.assertGreater(f["peer_group_size"], 0)


class TestBuildFeaturesIntegration(unittest.TestCase):

    def _tmpdir(self) -> str:
        if not hasattr(self, "_cached_tmpdir"):
            self._cached_tmpdir = TemporaryDirectory()
            self.addCleanup(self._cached_tmpdir.cleanup)
        return self._cached_tmpdir.name

    def test_build_features_from_parquet(self) -> None:
        tmp = self._tmpdir()
        norm_dir = Path(tmp) / "normalized"
        feat_dir = Path(tmp) / "features"
        norm_dir.mkdir()

        # Write a minimal org_year_panel.parquet
        rows = [_make_org_year_row()]
        schema = pa.schema([
            pa.field("ein", pa.string()),
            pa.field("organization_name", pa.string()),
            pa.field("tax_year", pa.string()),
            pa.field("state", pa.string()),
            pa.field("city", pa.string()),
            pa.field("total_revenue", pa.int64()),
            pa.field("total_expenses", pa.int64()),
            pa.field("contributions_grants", pa.int64()),
            pa.field("program_service_revenue", pa.int64()),
            pa.field("investment_income", pa.int64()),
            pa.field("other_revenue", pa.int64()),
            pa.field("program_expenses", pa.int64()),
            pa.field("total_assets_eoy", pa.int64()),
            pa.field("total_liabilities_eoy", pa.int64()),
            pa.field("net_assets_eoy", pa.int64()),
            pa.field("total_employee_count", pa.int64()),
            pa.field("gross_receipts", pa.int64()),
        ])
        cols = {f.name: pa.array([rows[0].get(f.name)], type=f.type) for f in schema}
        pq.write_table(pa.table(cols), norm_dir / "org_year_panel.parquet")

        result = build_features(norm_dir, feat_dir)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["features_computed"], 1)
        self.assertTrue(Path(result["outputs"]["features_parquet"]).exists())
        self.assertTrue(Path(result["outputs"]["feature_qa_report"]).exists())

    def test_missing_panel_returns_error(self) -> None:
        tmp = self._tmpdir()
        result = build_features(Path(tmp) / "missing", Path(tmp) / "out")
        self.assertEqual(result["status"], "error")


if __name__ == "__main__":
    unittest.main()
