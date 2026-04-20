"""Normalize IRS 990 XML corpus into canonical Parquet tables and manifests.

Replaces the previous stub with a real artifact-producing pipeline:
  - data/processed/normalized/filings.parquet
  - data/processed/normalized/org_year_panel.parquet
  - data/processed/manifests/normalization_manifest.json
  - data/processed/manifests/normalization_dictionary.json
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

from .constants import DEFAULT_XML_SUFFIX
from .xml_parser import CANONICAL_FIELD_MAP, NUMERIC_FIELDS, ParseResult, parse_990_xml


# ── Schema for the filings table ──────────────────────────────────────────

FILINGS_SCHEMA = pa.schema([
    pa.field("ein", pa.string()),
    pa.field("organization_name", pa.string()),
    pa.field("tax_year", pa.string()),
    pa.field("tax_period_begin", pa.string()),
    pa.field("tax_period_end", pa.string()),
    pa.field("form_type", pa.string()),
    pa.field("return_version", pa.string()),
    pa.field("return_timestamp", pa.string()),
    pa.field("state", pa.string()),
    pa.field("city", pa.string()),
    pa.field("zip_code", pa.string()),
    pa.field("total_revenue", pa.int64()),
    pa.field("contributions_grants", pa.int64()),
    pa.field("program_service_revenue", pa.int64()),
    pa.field("investment_income", pa.int64()),
    pa.field("other_revenue", pa.int64()),
    pa.field("total_expenses", pa.int64()),
    pa.field("revenues_less_expenses", pa.int64()),
    pa.field("program_expenses", pa.int64()),
    pa.field("total_functional_expenses", pa.int64()),
    pa.field("net_assets_eoy", pa.int64()),
    pa.field("total_assets_eoy", pa.int64()),
    pa.field("total_liabilities_eoy", pa.int64()),
    pa.field("website", pa.string()),
    pa.field("formation_year", pa.string()),
    pa.field("total_employee_count", pa.int64()),
    pa.field("mission_description", pa.string()),
    pa.field("is_501c3", pa.bool_()),
    pa.field("gross_receipts", pa.int64()),
    pa.field("voting_members_count", pa.int64()),
    pa.field("independent_voting_members_count", pa.int64()),
    pa.field("amended_return_ind", pa.string()),
    pa.field("parse_confidence", pa.float64()),
    pa.field("source_path", pa.string()),
    pa.field("parse_status", pa.string()),
])


# ── Data Dictionary ────────────────────────────────────────────────────────

DATA_DICTIONARY: list[dict[str, str]] = [
    {"field": "ein", "type": "string", "source": "ReturnHeader/Filer/EIN", "description": "Employer Identification Number (9-digit IRS identifier)"},
    {"field": "organization_name", "type": "string", "source": "ReturnHeader/Filer/BusinessName/BusinessNameLine1Txt", "description": "Legal name of the organization"},
    {"field": "tax_year", "type": "string", "source": "ReturnHeader/TaxYr", "description": "Tax year of the filing"},
    {"field": "tax_period_begin", "type": "string", "source": "ReturnHeader/TaxPeriodBeginDt", "description": "Start of the tax period (YYYY-MM-DD)"},
    {"field": "tax_period_end", "type": "string", "source": "ReturnHeader/TaxPeriodEndDt", "description": "End of the tax period (YYYY-MM-DD)"},
    {"field": "form_type", "type": "string", "source": "ReturnHeader/ReturnTypeCd", "description": "IRS form type (990 for full filings)"},
    {"field": "return_version", "type": "string", "source": "@returnVersion attribute", "description": "Schema version of the XML filing"},
    {"field": "return_timestamp", "type": "string", "source": "ReturnHeader/ReturnTs", "description": "Timestamp when the return was filed"},
    {"field": "state", "type": "string", "source": "ReturnHeader/Filer/USAddress/StateAbbreviationCd", "description": "Two-letter state abbreviation of the filer"},
    {"field": "city", "type": "string", "source": "ReturnHeader/Filer/USAddress/CityNm", "description": "City of the filer"},
    {"field": "zip_code", "type": "string", "source": "ReturnHeader/Filer/USAddress/ZIPCd", "description": "ZIP code of the filer"},
    {"field": "total_revenue", "type": "int64", "source": "IRS990/CYTotalRevenueAmt", "description": "Total revenue for the current year"},
    {"field": "contributions_grants", "type": "int64", "source": "IRS990/CYContributionsGrantsAmt", "description": "Contributions and grants received"},
    {"field": "program_service_revenue", "type": "int64", "source": "IRS990/CYProgramServiceRevenueAmt", "description": "Revenue from program services"},
    {"field": "investment_income", "type": "int64", "source": "IRS990/CYInvestmentIncomeAmt", "description": "Income from investments"},
    {"field": "other_revenue", "type": "int64", "source": "IRS990/CYOtherRevenueAmt", "description": "Other revenue not classified above"},
    {"field": "total_expenses", "type": "int64", "source": "IRS990/CYTotalExpensesAmt", "description": "Total expenses for the current year"},
    {"field": "revenues_less_expenses", "type": "int64", "source": "IRS990/CYRevenuesLessExpensesAmt", "description": "Net income (revenues minus expenses)"},
    {"field": "program_expenses", "type": "int64", "source": "IRS990/TotalProgramServiceExpensesAmt", "description": "Total program service expenses"},
    {"field": "total_functional_expenses", "type": "int64", "source": "IRS990/TotalFunctionalExpensesGrp/TotalAmt", "description": "Total functional expenses (all categories)"},
    {"field": "net_assets_eoy", "type": "int64", "source": "IRS990/NetAssetsOrFundBalancesEOYAmt", "description": "Net assets or fund balances at end of year"},
    {"field": "total_assets_eoy", "type": "int64", "source": "IRS990/TotalAssetsEOYAmt", "description": "Total assets at end of year"},
    {"field": "total_liabilities_eoy", "type": "int64", "source": "IRS990/TotalLiabilitiesEOYAmt", "description": "Total liabilities at end of year"},
    {"field": "website", "type": "string", "source": "IRS990/WebsiteAddressTxt", "description": "Organization website URL"},
    {"field": "formation_year", "type": "string", "source": "IRS990/FormationYr", "description": "Year the organization was formed"},
    {"field": "total_employee_count", "type": "int64", "source": "IRS990/TotalEmployeeCnt", "description": "Total number of employees"},
    {"field": "mission_description", "type": "string", "source": "IRS990/ActivityOrMissionDesc", "description": "Description of the organization's mission"},
    {"field": "is_501c3", "type": "bool", "source": "IRS990/Organization501c3Ind", "description": "Whether the organization is a 501(c)(3)"},
    {"field": "gross_receipts", "type": "int64", "source": "IRS990/GrossReceiptsAmt", "description": "Gross receipts amount"},
    {"field": "voting_members_count", "type": "int64", "source": "IRS990/VotingMembersGoverningBodyCnt", "description": "Number of voting members on governing body"},
    {"field": "independent_voting_members_count", "type": "int64", "source": "IRS990/VotingMembersIndependentCnt", "description": "Number of independent voting members"},
    {"field": "amended_return_ind", "type": "string", "source": "ReturnHeader/AmendedReturnInd", "description": "Indicator for amended return (if present)"},
    {"field": "parse_confidence", "type": "float64", "source": "derived", "description": "Fraction of canonical fields successfully resolved (0.0-1.0)"},
    {"field": "source_path", "type": "string", "source": "derived", "description": "Relative path to the source XML file"},
    {"field": "parse_status", "type": "string", "source": "derived", "description": "Parse status: ok, malformed, or not_990"},
]

# Fields consumed by downstream feature engineering, scoring, and scenario phases
DOWNSTREAM_CONSUMERS = {
    "build-features": {
        "consumes": "data/processed/normalized/filings.parquet, data/processed/normalized/org_year_panel.parquet",
        "description": "Feature engineering reads both normalized tables to compute ratios, trends, and peer-comparison metrics.",
    },
    "scoring": {
        "consumes": "data/processed/features/ (output of build-features)",
        "description": "Risk/resilience scoring reads feature tables, not normalized tables directly.",
    },
    "scenario-simulation": {
        "consumes": "data/processed/features/ (output of build-features)",
        "description": "Scenario projections apply shocks to feature-level aggregates.",
    },
    "frontend-artifact-swap": {
        "consumes": "data/processed/artifacts/ (output of scoring + scenarios)",
        "description": "Frontend replaces mock data with scored artifacts. No direct dependency on normalized tables.",
    },
}


class NormalizationError(Exception):
    """Raised when normalization cannot proceed."""


def _discover_xml_files(raw_root: Path, form_filter: str = "990") -> list[Path]:
    """Find all XML files under raw_root in partitions matching form_filter.

    Only includes partitions whose directory name ends with the given form code
    (e.g. ``2020_990``) but NOT compound forms like ``990PF`` or ``990T``.
    """
    xml_files: list[Path] = []
    for xml_path in sorted(raw_root.rglob(f"*{DEFAULT_XML_SUFFIX}")):
        if not xml_path.is_file():
            continue
        # Check partition directory matches plain 990
        for part in xml_path.relative_to(raw_root).parts:
            # Match YYYY_990 but not YYYY_990PF or YYYY_990T etc.
            if part.endswith(f"_{form_filter}") and not any(
                part.endswith(f"_{form_filter}{suffix}") for suffix in ("PF", "T", "EZ", "N", "O")
            ):
                xml_files.append(xml_path)
                break
    return xml_files


def _resolve_duplicates(
    filings: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, str]]]]:
    """Deduplicate filings by EIN + tax_year, keeping the latest.

    Returns (deduped list, duplicate_buckets mapping).
    """
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for filing in filings:
        key = f"{filing.get('ein', 'UNKNOWN')}_{filing.get('tax_year', 'UNKNOWN')}"
        buckets[key].append(filing)

    deduped: list[dict[str, Any]] = []
    duplicate_evidence: dict[str, list[dict[str, str]]] = {}

    for key, group in sorted(buckets.items()):
        if len(group) == 1:
            deduped.append(group[0])
            continue

        # Sort by return_timestamp descending (latest first); fall back to source_path
        group.sort(
            key=lambda f: (f.get("return_timestamp") or "", f.get("source_path") or ""),
            reverse=True,
        )
        deduped.append(group[0])

        # Record lineage of dropped filings
        duplicate_evidence[key] = [
            {
                "source_path": f.get("source_path", ""),
                "return_timestamp": f.get("return_timestamp", ""),
                "disposition": "kept" if i == 0 else "dropped",
            }
            for i, f in enumerate(group)
        ]

    return deduped, duplicate_evidence


def _build_org_year_panel(filings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Flatten deduplicated filings into the org-year panel table.

    The org-year panel is one row per unique EIN + tax_year, containing all
    canonical fields plus a ``duplicate_count`` column.
    """
    # Count how many filings existed per EIN+year before dedup
    panel: list[dict[str, Any]] = []
    for filing in filings:
        row = dict(filing)
        row["org_year_key"] = f"{filing.get('ein', 'UNKNOWN')}_{filing.get('tax_year', 'UNKNOWN')}"
        panel.append(row)
    return panel


def normalize_corpus(raw_root: Path, output_dir: Path) -> dict[str, Any]:
    """Parse the mirrored Drive XML corpus and emit canonical tables.

    Raises NormalizationError if no XML files are found.

    Writes:
      - output_dir/filings.parquet
      - output_dir/org_year_panel.parquet
      - manifests_dir/normalization_manifest.json
      - manifests_dir/normalization_dictionary.json
    """
    raw_root = raw_root.expanduser().resolve()
    output_dir = output_dir.expanduser().resolve()
    manifests_dir = output_dir.parent / "manifests"

    # ── Gate: fail hard if no raw XML ──────────────────────────────────
    xml_files = _discover_xml_files(raw_root)
    if not xml_files:
        raise NormalizationError(
            f"No 990 XML files found under {raw_root}. "
            "Mirror the Drive corpus into data/raw/IRS990Data/XML Files/<year>_990/ first."
        )

    # ── Parse all files ────────────────────────────────────────────────
    all_results: list[ParseResult] = []
    ok_filings: list[dict[str, Any]] = []
    quarantined: list[dict[str, str]] = []
    skipped_non_990: list[dict[str, str]] = []

    alias_usage: Counter[str] = Counter()
    unresolved_counter: Counter[str] = Counter()

    for xml_path in xml_files:
        result = parse_990_xml(xml_path)
        all_results.append(result)

        if result.status == "ok":
            ok_filings.append(result.fields)
            for alias in result.resolved_aliases.values():
                alias_usage[alias] += 1
            for field_name in result.unresolved_fields:
                unresolved_counter[field_name] += 1

        elif result.status == "malformed":
            quarantined.append({
                "source_path": result.source_path,
                "error": result.error_message or "unknown",
            })

        elif result.status == "not_990":
            skipped_non_990.append({
                "source_path": result.source_path,
                "reason": result.error_message or "not a full 990",
            })

    # ── Duplicate resolution ───────────────────────────────────────────
    deduped_filings, duplicate_buckets = _resolve_duplicates(ok_filings)
    amended_count = sum(
        1 for f in ok_filings if f.get("amended_return_ind") is not None
    )

    # ── Write Parquet outputs ──────────────────────────────────────────
    output_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)

    filings_path = output_dir / "filings.parquet"
    panel_path = output_dir / "org_year_panel.parquet"

    # Write all parsed filings (including duplicates) to filings.parquet
    _write_parquet(ok_filings, filings_path, FILINGS_SCHEMA)

    # Write deduped org-year panel
    panel_rows = _build_org_year_panel(deduped_filings)
    panel_schema = pa.schema(
        list(FILINGS_SCHEMA) + [pa.field("org_year_key", pa.string())]
    )
    _write_parquet(panel_rows, panel_path, panel_schema)

    # ── Year counts ────────────────────────────────────────────────────
    year_counts: Counter[str] = Counter()
    for f in ok_filings:
        yr = f.get("tax_year") or "unknown"
        year_counts[yr] += 1

    # ── Build normalization manifest ───────────────────────────────────
    manifest = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "raw_root": str(raw_root),
        "output_dir": str(output_dir),
        "summary": {
            "xml_files_scanned": len(xml_files),
            "filings_parsed_ok": len(ok_filings),
            "filings_quarantined": len(quarantined),
            "filings_skipped_non_990": len(skipped_non_990),
            "unique_org_years": len(deduped_filings),
            "duplicate_buckets": len(duplicate_buckets),
            "amended_return_count": amended_count,
            "year_counts": dict(sorted(year_counts.items())),
        },
        "field_mapping_coverage": {
            field_name: {
                "resolved_count": len(ok_filings) - unresolved_counter.get(field_name, 0),
                "unresolved_count": unresolved_counter.get(field_name, 0),
                "coverage_pct": round(
                    (len(ok_filings) - unresolved_counter.get(field_name, 0)) / max(len(ok_filings), 1), 3
                ),
            }
            for field_name in CANONICAL_FIELD_MAP
        },
        "fallback_rules_used": dict(alias_usage.most_common()),
        "unresolved_fields_summary": dict(unresolved_counter.most_common()),
        "quarantined_files": quarantined,
        "skipped_non_990": skipped_non_990,
        "duplicate_buckets": {
            k: v for k, v in duplicate_buckets.items() if len(v) > 1
        },
        "outputs": {
            "filings_parquet": str(filings_path),
            "org_year_panel_parquet": str(panel_path),
            "normalization_manifest": str(manifests_dir / "normalization_manifest.json"),
            "normalization_dictionary": str(manifests_dir / "normalization_dictionary.json"),
        },
        "downstream_consumers": DOWNSTREAM_CONSUMERS,
    }

    manifest_path = manifests_dir / "normalization_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    # ── Write data dictionary ──────────────────────────────────────────
    dictionary = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "schema_version": "v1",
        "form_types_supported": ["990"],
        "form_types_planned": ["990-EZ"],
        "form_types_excluded": ["990-PF"],
        "fields": DATA_DICTIONARY,
        "notes": [
            "All monetary values are whole-dollar integers as reported on the filing.",
            "parse_confidence is the fraction of canonical fields that resolved to a value.",
            "org_year_panel contains one row per unique EIN+tax_year after duplicate resolution.",
        ],
    }
    dictionary_path = manifests_dir / "normalization_dictionary.json"
    dictionary_path.write_text(json.dumps(dictionary, indent=2) + "\n", encoding="utf-8")

    return {
        "status": "ok",
        "step": "normalize",
        "filings_parsed": len(ok_filings),
        "unique_org_years": len(deduped_filings),
        "quarantined": len(quarantined),
        "outputs": {
            "filings_parquet": str(filings_path),
            "org_year_panel_parquet": str(panel_path),
            "normalization_manifest": str(manifest_path),
            "normalization_dictionary": str(dictionary_path),
        },
    }


def _write_parquet(
    rows: list[dict[str, Any]], path: Path, schema: pa.Schema
) -> None:
    """Write a list of dicts to a Parquet file using the given schema."""
    if not rows:
        # Write an empty table with the schema so downstream can still read columns
        table = pa.table({f.name: pa.array([], type=f.type) for f in schema})
        pq.write_table(table, path)
        return

    columns: dict[str, list[Any]] = {f.name: [] for f in schema}
    for row in rows:
        for f in schema:
            columns[f.name].append(row.get(f.name))

    arrays = []
    for f in schema:
        col_data = columns[f.name]
        arrays.append(pa.array(col_data, type=f.type))

    table = pa.table({f.name: arr for f, arr in zip(schema, arrays)})
    pq.write_table(table, path)
