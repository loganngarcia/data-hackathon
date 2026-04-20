"""Tests for the resilience scoring model."""

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

from hackathon_pipeline.scoring import score_organization, score_portfolio, SIGNAL_FUNCTIONS


def _healthy_features() -> dict:
    return {
        "ein": "111111111",
        "organization_name": "HEALTHY ORG",
        "tax_year": "2020",
        "state": "CA",
        "city": "GOODTOWN",
        "size_band": "mid",
        "total_revenue": 5_000_000,
        "total_expenses": 4_000_000,
        "operating_margin": 0.20,
        "avg_operating_margin_3yr": 0.18,
        "months_of_reserve": 18.0,
        "revenue_hhi": 0.30,
        "revenue_growth_yoy": 0.08,
        "revenue_volatility_3yr": 0.05,
        "net_asset_change_yoy": 0.10,
        "employee_change_yoy": 0.02,
        "contribution_share": 0.4,
        "program_revenue_share": 0.4,
        "investment_share": 0.1,
        "net_assets_eoy": 6_000_000,
        "total_employee_count": 50,
        "program_expense_ratio": 0.80,
        "years_of_data": 3,
        "peer_group": "mid_CA",
        "margin_pctile_peer": 0.8,
        "reserve_pctile_peer": 0.7,
        "concentration_pctile_peer": 0.6,
        "margin_pctile_size": 0.75,
    }


def _distressed_features() -> dict:
    return {
        "ein": "999999999",
        "organization_name": "STRUGGLING ORG",
        "tax_year": "2020",
        "state": "NY",
        "city": "HARDTOWN",
        "size_band": "small",
        "total_revenue": 800_000,
        "total_expenses": 950_000,
        "operating_margin": -0.19,
        "avg_operating_margin_3yr": -0.12,
        "months_of_reserve": 1.5,
        "revenue_hhi": 0.85,
        "revenue_growth_yoy": -0.20,
        "revenue_volatility_3yr": 0.35,
        "net_asset_change_yoy": -0.25,
        "employee_change_yoy": -0.20,
        "contribution_share": 0.9,
        "program_revenue_share": 0.05,
        "investment_share": 0.02,
        "net_assets_eoy": 120_000,
        "total_employee_count": 5,
        "program_expense_ratio": 0.60,
        "years_of_data": 3,
        "peer_group": "small_NY",
        "margin_pctile_peer": 0.1,
        "reserve_pctile_peer": 0.1,
        "concentration_pctile_peer": 0.9,
        "margin_pctile_size": 0.1,
    }


class TestScoreOrganization(unittest.TestCase):

    def test_healthy_org_gets_high_score(self) -> None:
        result = score_organization(_healthy_features())
        self.assertGreater(result["resilience_score"], 0.6)
        self.assertEqual(result["risk_band"], "Steady")

    def test_distressed_org_gets_low_score(self) -> None:
        result = score_organization(_distressed_features())
        self.assertLess(result["resilience_score"], 0.35)
        self.assertIn(result["risk_band"], ("Watch", "At Risk"))

    def test_score_has_all_signals(self) -> None:
        result = score_organization(_healthy_features())
        signals = result["signals"]
        for name, _, _ in SIGNAL_FUNCTIONS:
            self.assertIn(name, signals)
            self.assertIn("score", signals[name])
            self.assertIn("explanation", signals[name])

    def test_top_drivers_limited_to_3(self) -> None:
        result = score_organization(_healthy_features())
        self.assertLessEqual(len(result["top_drivers"]), 3)

    def test_score_range_valid(self) -> None:
        for feat in [_healthy_features(), _distressed_features()]:
            result = score_organization(feat)
            self.assertGreaterEqual(result["resilience_score"], 0.0)
            self.assertLessEqual(result["resilience_score"], 1.0)

    def test_signal_weights_sum_to_1(self) -> None:
        total = sum(w for _, _, w in SIGNAL_FUNCTIONS)
        self.assertAlmostEqual(total, 1.0, places=2)


class TestScorePortfolioIntegration(unittest.TestCase):

    def _tmpdir(self) -> str:
        if not hasattr(self, "_cached_tmpdir"):
            self._cached_tmpdir = TemporaryDirectory()
            self.addCleanup(self._cached_tmpdir.cleanup)
        return self._cached_tmpdir.name

    def test_score_portfolio_produces_outputs(self) -> None:
        tmp = self._tmpdir()
        feat_dir = Path(tmp) / "features"
        score_dir = Path(tmp) / "scores"
        feat_dir.mkdir()

        from hackathon_pipeline.features import FEATURES_SCHEMA
        feat = _healthy_features()
        cols = {}
        for f in FEATURES_SCHEMA:
            cols[f.name] = pa.array([feat.get(f.name)], type=f.type)
        pq.write_table(pa.table(cols), feat_dir / "features.parquet")

        result = score_portfolio(feat_dir, score_dir)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["organizations_scored"], 1)
        self.assertTrue(Path(result["outputs"]["scores_parquet"]).exists())
        self.assertTrue(Path(result["outputs"]["scores_detail_json"]).exists())


if __name__ == "__main__":
    unittest.main()
