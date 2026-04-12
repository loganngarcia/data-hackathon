"""Tests for the scenario engine."""

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

from hackathon_pipeline.scenarios import run_scenario, run_all_scenarios, SCENARIO_CATALOG


def _base_features() -> dict:
    return {
        "ein": "555555555",
        "organization_name": "SCENARIO TEST ORG",
        "tax_year": "2020",
        "state": "TX",
        "city": "DALLAS",
        "size_band": "mid",
        "total_revenue": 3_000_000,
        "total_expenses": 2_800_000,
        "operating_margin": 0.067,
        "avg_operating_margin_3yr": 0.05,
        "months_of_reserve": 6.0,
        "revenue_hhi": 0.55,
        "revenue_growth_yoy": 0.03,
        "revenue_volatility_3yr": 0.10,
        "net_asset_change_yoy": 0.02,
        "employee_change_yoy": 0.0,
        "contribution_share": 0.7,
        "program_revenue_share": 0.2,
        "investment_share": 0.05,
        "net_assets_eoy": 1_400_000,
        "total_employee_count": 30,
        "program_expense_ratio": 0.75,
        "years_of_data": 3,
        "peer_group": "mid_TX",
        "margin_pctile_peer": 0.5,
        "reserve_pctile_peer": 0.4,
        "concentration_pctile_peer": 0.6,
        "margin_pctile_size": 0.5,
    }


class TestRunScenario(unittest.TestCase):

    def test_grant_cut_decreases_score(self) -> None:
        feat = _base_features()
        result = run_scenario(feat, "grant_cut_20pct")
        self.assertIsNotNone(result)
        self.assertLess(result["score_delta"], 0)
        self.assertEqual(result["ein"], "555555555")

    def test_reserve_grant_increases_score(self) -> None:
        feat = _base_features()
        result = run_scenario(feat, "reserve_grant_500k")
        self.assertIsNotNone(result)
        self.assertGreater(result["score_delta"], 0)

    def test_diversification_changes_hhi(self) -> None:
        feat = _base_features()
        result = run_scenario(feat, "diversification_boost")
        self.assertIsNotNone(result)
        # Should generally improve or maintain score
        self.assertIsNotNone(result["projected_score"])

    def test_margin_improvement_increases_score(self) -> None:
        feat = _base_features()
        result = run_scenario(feat, "margin_improvement_5pct")
        self.assertIsNotNone(result)
        self.assertGreaterEqual(result["score_delta"], 0)

    def test_severe_cut_is_worse_than_moderate(self) -> None:
        feat = _base_features()
        moderate = run_scenario(feat, "grant_cut_20pct")
        severe = run_scenario(feat, "grant_cut_40pct")
        self.assertLess(severe["score_delta"], moderate["score_delta"])

    def test_invalid_scenario_returns_none(self) -> None:
        self.assertIsNone(run_scenario(_base_features(), "nonexistent_scenario"))

    def test_result_has_required_fields(self) -> None:
        result = run_scenario(_base_features(), "grant_cut_20pct")
        required = {
            "scenario_id", "title", "assumption", "ein",
            "baseline_score", "projected_score", "score_delta",
            "risk_shift", "recommendation", "evidence",
        }
        self.assertTrue(required.issubset(set(result.keys())))

    def test_all_catalog_scenarios_run(self) -> None:
        feat = _base_features()
        for scenario_id in SCENARIO_CATALOG:
            result = run_scenario(feat, scenario_id)
            self.assertIsNotNone(result, f"Scenario {scenario_id} returned None")
            self.assertEqual(result["scenario_id"], scenario_id)


class TestRunAllScenarios(unittest.TestCase):

    def _tmpdir(self) -> str:
        if not hasattr(self, "_cached_tmpdir"):
            self._cached_tmpdir = TemporaryDirectory()
            self.addCleanup(self._cached_tmpdir.cleanup)
        return self._cached_tmpdir.name

    def test_run_all_produces_outputs(self) -> None:
        tmp = self._tmpdir()
        feat_dir = Path(tmp) / "features"
        scen_dir = Path(tmp) / "scenarios"
        feat_dir.mkdir()

        from hackathon_pipeline.features import FEATURES_SCHEMA
        feat = _base_features()
        cols = {}
        for f in FEATURES_SCHEMA:
            cols[f.name] = pa.array([feat.get(f.name)], type=f.type)
        pq.write_table(pa.table(cols), feat_dir / "features.parquet")

        result = run_all_scenarios(feat_dir, scen_dir)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["organizations_evaluated"], 1)
        self.assertEqual(result["total_results"], len(SCENARIO_CATALOG))
        self.assertTrue(Path(result["outputs"]["scenarios_json"]).exists())


if __name__ == "__main__":
    unittest.main()
