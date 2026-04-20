"""Feature engineering: consume normalized org-year panel and produce analytical features.

Builds lagged, rolling, ratio, and peer-relative features from the canonical
base table. Outputs feature tables and a QA report under data/processed/features/.
"""

from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq


# ── Peer segments ──────────────────────────────────────────────────────────

SIZE_BANDS = [
    ("micro", 0, 500_000),
    ("small", 500_000, 2_000_000),
    ("mid", 2_000_000, 10_000_000),
    ("large", 10_000_000, 50_000_000),
    ("mega", 50_000_000, float("inf")),
]


def _size_band(revenue: int | None) -> str:
    if revenue is None:
        return "unknown"
    for label, lo, hi in SIZE_BANDS:
        if lo <= revenue < hi:
            return label
    return "unknown"


def _safe_div(a: int | float | None, b: int | float | None) -> float | None:
    if a is None or b is None or b == 0:
        return None
    return a / b


def _pct_change(current: int | None, prior: int | None) -> float | None:
    if current is None or prior is None or prior == 0:
        return None
    return (current - prior) / abs(prior)


def _percentile_rank(value: float | None, values: list[float]) -> float | None:
    if value is None or not values:
        return None
    below = sum(1 for v in values if v < value)
    return below / len(values)


# ── Feature computation ───────────────────────────────────────────────────

def _build_org_history(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Group rows by EIN, sorted by tax_year ascending."""
    orgs: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        ein = row.get("ein")
        if ein:
            orgs[ein].append(row)
    for ein in orgs:
        orgs[ein].sort(key=lambda r: r.get("tax_year", ""))
    return orgs


def compute_features(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compute analytical features for each org-year record.

    Returns a list of feature dicts, one per org-year, keyed by ein+tax_year.
    """
    org_history = _build_org_history(rows)
    features: list[dict[str, Any]] = []

    for ein, history in org_history.items():
        for i, row in enumerate(history):
            feat: dict[str, Any] = {
                "ein": ein,
                "organization_name": row.get("organization_name"),
                "tax_year": row.get("tax_year"),
                "state": row.get("state"),
                "city": row.get("city"),
            }

            revenue = row.get("total_revenue")
            expenses = row.get("total_expenses")
            net_assets = row.get("net_assets_eoy")
            contributions = row.get("contributions_grants")
            program_rev = row.get("program_service_revenue")
            investment_inc = row.get("investment_income")
            other_rev = row.get("other_revenue")
            program_exp = row.get("program_expenses")
            total_assets = row.get("total_assets_eoy")
            total_liabilities = row.get("total_liabilities_eoy")
            employees = row.get("total_employee_count")
            gross_receipts = row.get("gross_receipts")

            # ── Size and segment ──────────────────────────────────
            feat["size_band"] = _size_band(revenue)
            feat["total_revenue"] = revenue
            feat["total_expenses"] = expenses

            # ── Ratios ────────────────────────────────────────────
            feat["operating_margin"] = _safe_div(
                (revenue - expenses) if revenue is not None and expenses is not None else None,
                revenue,
            )
            feat["program_expense_ratio"] = _safe_div(program_exp, expenses)
            feat["admin_expense_ratio"] = (
                _safe_div(
                    (expenses - program_exp) if expenses is not None and program_exp is not None else None,
                    expenses,
                )
            )

            # Revenue concentration (HHI-like)
            rev_streams = [
                contributions or 0,
                program_rev or 0,
                investment_inc or 0,
                other_rev or 0,
            ]
            rev_total = sum(rev_streams)
            if rev_total > 0:
                shares = [s / rev_total for s in rev_streams]
                feat["revenue_hhi"] = sum(s * s for s in shares)
                feat["contribution_share"] = shares[0]
                feat["program_revenue_share"] = shares[1]
                feat["investment_share"] = shares[2]
            else:
                feat["revenue_hhi"] = None
                feat["contribution_share"] = None
                feat["program_revenue_share"] = None
                feat["investment_share"] = None

            # Liquidity / reserves
            feat["net_assets_eoy"] = net_assets
            feat["months_of_reserve"] = (
                _safe_div(net_assets, expenses / 12)
                if net_assets is not None and expenses is not None and expenses > 0
                else None
            )
            feat["debt_to_asset_ratio"] = _safe_div(total_liabilities, total_assets)

            feat["total_employee_count"] = employees
            feat["revenue_per_employee"] = _safe_div(revenue, employees)

            # ── Lagged / YoY features ─────────────────────────────
            if i > 0:
                prev = history[i - 1]
                prev_rev = prev.get("total_revenue")
                prev_exp = prev.get("total_expenses")
                prev_net = prev.get("net_assets_eoy")
                prev_emp = prev.get("total_employee_count")

                feat["revenue_growth_yoy"] = _pct_change(revenue, prev_rev)
                feat["expense_growth_yoy"] = _pct_change(expenses, prev_exp)
                feat["net_asset_change_yoy"] = _pct_change(net_assets, prev_net)
                feat["employee_change_yoy"] = _pct_change(employees, prev_emp)
            else:
                feat["revenue_growth_yoy"] = None
                feat["expense_growth_yoy"] = None
                feat["net_asset_change_yoy"] = None
                feat["employee_change_yoy"] = None

            # ── Rolling features (3-year window) ──────────────────
            window = history[max(0, i - 2):i + 1]
            rev_window = [r.get("total_revenue") for r in window if r.get("total_revenue") is not None]

            if len(rev_window) >= 2:
                mean_rev = sum(rev_window) / len(rev_window)
                variance = sum((r - mean_rev) ** 2 for r in rev_window) / len(rev_window)
                feat["revenue_volatility_3yr"] = math.sqrt(variance) / mean_rev if mean_rev > 0 else None
                feat["revenue_trend_3yr"] = _pct_change(rev_window[-1], rev_window[0])
            else:
                feat["revenue_volatility_3yr"] = None
                feat["revenue_trend_3yr"] = None

            margin_window = []
            for r in window:
                rev_w = r.get("total_revenue")
                exp_w = r.get("total_expenses")
                if rev_w is not None and exp_w is not None and rev_w > 0:
                    margin_window.append((rev_w - exp_w) / rev_w)
            feat["avg_operating_margin_3yr"] = (
                sum(margin_window) / len(margin_window) if margin_window else None
            )

            # Number of years of data available
            feat["years_of_data"] = len(history)
            feat["year_index"] = i  # 0-based position in org's history

            features.append(feat)

    return features


def compute_peer_features(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add peer-relative percentile ranks by size_band + state."""
    # Build peer groups
    peer_groups: dict[str, list[int]] = defaultdict(list)
    for i, feat in enumerate(features):
        key = f"{feat.get('size_band', 'unknown')}_{feat.get('state', 'unknown')}"
        peer_groups[key].append(i)

    # Also build size-only peer groups for broader comparison
    size_groups: dict[str, list[int]] = defaultdict(list)
    for i, feat in enumerate(features):
        size_groups[feat.get("size_band", "unknown")].append(i)

    for feat in features:
        key = f"{feat.get('size_band', 'unknown')}_{feat.get('state', 'unknown')}"
        size_key = feat.get("size_band", "unknown")

        # Peer percentiles by size+state
        peer_indices = peer_groups.get(key, [])
        peer_margins = [features[j]["operating_margin"] for j in peer_indices
                        if features[j].get("operating_margin") is not None]
        peer_reserves = [features[j]["months_of_reserve"] for j in peer_indices
                         if features[j].get("months_of_reserve") is not None]
        peer_hhi = [features[j]["revenue_hhi"] for j in peer_indices
                    if features[j].get("revenue_hhi") is not None]

        feat["margin_pctile_peer"] = _percentile_rank(feat.get("operating_margin"), peer_margins)
        feat["reserve_pctile_peer"] = _percentile_rank(feat.get("months_of_reserve"), peer_reserves)
        feat["concentration_pctile_peer"] = _percentile_rank(feat.get("revenue_hhi"), peer_hhi)
        feat["peer_group_size"] = len(peer_indices)
        feat["peer_group"] = key

        # Broader size-band percentiles
        size_indices = size_groups.get(size_key, [])
        size_margins = [features[j]["operating_margin"] for j in size_indices
                        if features[j].get("operating_margin") is not None]
        feat["margin_pctile_size"] = _percentile_rank(feat.get("operating_margin"), size_margins)

    return features


# ── QA report ──────────────────────────────────────────────────────────────

def _feature_qa_report(features: list[dict[str, Any]]) -> dict[str, Any]:
    """Generate a QA report covering null rates, distributions, and coverage."""
    if not features:
        return {"row_count": 0, "fields": {}}

    field_names = list(features[0].keys())
    report: dict[str, Any] = {"row_count": len(features), "fields": {}}

    for field in field_names:
        values = [f.get(field) for f in features]
        non_null = [v for v in values if v is not None]
        numeric = [v for v in non_null if isinstance(v, (int, float)) and not isinstance(v, bool)]

        info: dict[str, Any] = {
            "null_count": len(values) - len(non_null),
            "null_rate": round((len(values) - len(non_null)) / len(values), 3),
            "distinct_count": len(set(str(v) for v in non_null)),
        }

        if numeric:
            sorted_vals = sorted(numeric)
            info["min"] = sorted_vals[0]
            info["max"] = sorted_vals[-1]
            info["mean"] = round(sum(sorted_vals) / len(sorted_vals), 4)
            info["median"] = sorted_vals[len(sorted_vals) // 2]
            info["p25"] = sorted_vals[len(sorted_vals) // 4]
            info["p75"] = sorted_vals[3 * len(sorted_vals) // 4]

        report["fields"][field] = info

    return report


# ── Output schema ──────────────────────────────────────────────────────────

FEATURES_SCHEMA = pa.schema([
    pa.field("ein", pa.string()),
    pa.field("organization_name", pa.string()),
    pa.field("tax_year", pa.string()),
    pa.field("state", pa.string()),
    pa.field("city", pa.string()),
    pa.field("size_band", pa.string()),
    pa.field("total_revenue", pa.int64()),
    pa.field("total_expenses", pa.int64()),
    pa.field("operating_margin", pa.float64()),
    pa.field("program_expense_ratio", pa.float64()),
    pa.field("admin_expense_ratio", pa.float64()),
    pa.field("revenue_hhi", pa.float64()),
    pa.field("contribution_share", pa.float64()),
    pa.field("program_revenue_share", pa.float64()),
    pa.field("investment_share", pa.float64()),
    pa.field("net_assets_eoy", pa.int64()),
    pa.field("months_of_reserve", pa.float64()),
    pa.field("debt_to_asset_ratio", pa.float64()),
    pa.field("total_employee_count", pa.int64()),
    pa.field("revenue_per_employee", pa.float64()),
    pa.field("revenue_growth_yoy", pa.float64()),
    pa.field("expense_growth_yoy", pa.float64()),
    pa.field("net_asset_change_yoy", pa.float64()),
    pa.field("employee_change_yoy", pa.float64()),
    pa.field("revenue_volatility_3yr", pa.float64()),
    pa.field("revenue_trend_3yr", pa.float64()),
    pa.field("avg_operating_margin_3yr", pa.float64()),
    pa.field("years_of_data", pa.int64()),
    pa.field("year_index", pa.int64()),
    pa.field("margin_pctile_peer", pa.float64()),
    pa.field("reserve_pctile_peer", pa.float64()),
    pa.field("concentration_pctile_peer", pa.float64()),
    pa.field("peer_group_size", pa.int64()),
    pa.field("peer_group", pa.string()),
    pa.field("margin_pctile_size", pa.float64()),
])


def _write_parquet(rows: list[dict[str, Any]], path: Path, schema: pa.Schema) -> None:
    if not rows:
        table = pa.table({f.name: pa.array([], type=f.type) for f in schema})
        pq.write_table(table, path)
        return

    columns: dict[str, list[Any]] = {f.name: [] for f in schema}
    for row in rows:
        for f in schema:
            columns[f.name].append(row.get(f.name))

    arrays = [pa.array(columns[f.name], type=f.type) for f in schema]
    table = pa.table({f.name: arr for f, arr in zip(schema, arrays)})
    pq.write_table(table, path)


# ── Public API ─────────────────────────────────────────────────────────────

def build_features(normalized_dir: Path, output_dir: Path) -> dict[str, Any]:
    """Consume normalized org-year panel and produce feature tables.

    Reads: normalized_dir/org_year_panel.parquet
    Writes:
      - output_dir/features.parquet
      - output_dir/../manifests/feature_qa_report.json
    """
    normalized_dir = Path(normalized_dir).expanduser().resolve()
    output_dir = Path(output_dir).expanduser().resolve()
    manifests_dir = output_dir.parent / "manifests"

    panel_path = normalized_dir / "org_year_panel.parquet"
    if not panel_path.exists():
        return {
            "status": "error",
            "step": "build-features",
            "message": f"Normalized panel not found at {panel_path}. Run normalize first.",
        }

    # Read normalized data
    table = pq.read_table(panel_path)
    rows = table.to_pylist()

    if not rows:
        return {
            "status": "error",
            "step": "build-features",
            "message": "Normalized panel is empty.",
        }

    # Compute features
    features = compute_features(rows)
    features = compute_peer_features(features)

    # Write outputs
    output_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)

    features_path = output_dir / "features.parquet"
    _write_parquet(features, features_path, FEATURES_SCHEMA)

    # QA report
    qa_report = _feature_qa_report(features)
    qa_report["generated_at"] = datetime.now(tz=timezone.utc).isoformat()
    qa_path = manifests_dir / "feature_qa_report.json"
    qa_path.write_text(json.dumps(qa_report, indent=2) + "\n", encoding="utf-8")

    return {
        "status": "ok",
        "step": "build-features",
        "features_computed": len(features),
        "unique_eins": len(set(f["ein"] for f in features)),
        "outputs": {
            "features_parquet": str(features_path),
            "feature_qa_report": str(qa_path),
        },
    }
