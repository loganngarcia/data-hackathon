"""Parse IRS Form 990 XML files into flat canonical dictionaries.

Handles namespace stripping, year-aware field alias resolution, and
robust error recovery for malformed files.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


IRS_NAMESPACE = "http://www.irs.gov/efile"
NS_PATTERN = re.compile(r"\{[^}]+\}")


# ---------------------------------------------------------------------------
# Canonical field map
# ---------------------------------------------------------------------------
# Maps canonical column name -> list of XPath-style tag names that may appear
# across different schema versions.  The parser tries each alias in order and
# takes the first hit.
CANONICAL_FIELD_MAP: dict[str, list[str]] = {
    # --- header-level ---
    "ein": ["ReturnHeader/Filer/EIN"],
    "organization_name": [
        "ReturnHeader/Filer/BusinessName/BusinessNameLine1Txt",
        "ReturnHeader/Filer/BusinessName/BusinessNameLine1",
    ],
    "tax_year": ["ReturnHeader/TaxYr"],
    "tax_period_begin": ["ReturnHeader/TaxPeriodBeginDt"],
    "tax_period_end": ["ReturnHeader/TaxPeriodEndDt"],
    "form_type": ["ReturnHeader/ReturnTypeCd"],
    "return_version": [],  # from root attribute
    "return_timestamp": ["ReturnHeader/ReturnTs"],
    # --- filer address ---
    "state": [
        "ReturnHeader/Filer/USAddress/StateAbbreviationCd",
        "ReturnData/IRS990/LegalDomicileStateCd",
    ],
    "city": ["ReturnHeader/Filer/USAddress/CityNm"],
    "zip_code": ["ReturnHeader/Filer/USAddress/ZIPCd"],
    # --- revenue ---
    "total_revenue": [
        "ReturnData/IRS990/CYTotalRevenueAmt",
        "ReturnData/IRS990/TotalRevenueCurrentYearAmt",
        "ReturnData/IRS990/TotalRevenueAmt",
    ],
    "contributions_grants": [
        "ReturnData/IRS990/CYContributionsGrantsAmt",
        "ReturnData/IRS990/ContributionsGrantsCurrentYearAmt",
        "ReturnData/IRS990/ContributionsAndGrantsAmt",
    ],
    "program_service_revenue": [
        "ReturnData/IRS990/CYProgramServiceRevenueAmt",
        "ReturnData/IRS990/ProgramServiceRevenueCurrentYearAmt",
        "ReturnData/IRS990/ProgramServiceRevenueAmt",
    ],
    "investment_income": [
        "ReturnData/IRS990/CYInvestmentIncomeAmt",
        "ReturnData/IRS990/InvestmentIncomeCurrentYearAmt",
        "ReturnData/IRS990/InvestmentIncomeAmt",
    ],
    "other_revenue": [
        "ReturnData/IRS990/CYOtherRevenueAmt",
        "ReturnData/IRS990/OtherRevenueCurrentYearAmt",
        "ReturnData/IRS990/OtherRevenueAmt",
    ],
    # --- expenses ---
    "total_expenses": [
        "ReturnData/IRS990/CYTotalExpensesAmt",
        "ReturnData/IRS990/TotalExpensesCurrentYearAmt",
        "ReturnData/IRS990/TotalExpensesAmt",
    ],
    "revenues_less_expenses": [
        "ReturnData/IRS990/CYRevenuesLessExpensesAmt",
        "ReturnData/IRS990/RevenuesLessExpensesCurrentYearAmt",
        "ReturnData/IRS990/RevenuesLessExpensesAmt",
    ],
    "program_expenses": [
        "ReturnData/IRS990/TotalProgramServiceExpensesAmt",
        "ReturnData/IRS990/TotalProgramServiceExpenseAmt",
    ],
    "total_functional_expenses": [
        "ReturnData/IRS990/TotalFunctionalExpensesGrp/TotalAmt",
        "ReturnData/IRS990/TotalFunctionalExpenses/Total",
    ],
    # --- balance sheet ---
    "net_assets_eoy": [
        "ReturnData/IRS990/NetAssetsOrFundBalancesEOYAmt",
        "ReturnData/IRS990/NetAssetsOrFundBalancesEndOfYearAmt",
    ],
    "total_assets_eoy": [
        "ReturnData/IRS990/TotalAssetsEOYAmt",
        "ReturnData/IRS990/TotalAssetsEndOfYearAmt",
    ],
    "total_liabilities_eoy": [
        "ReturnData/IRS990/TotalLiabilitiesEOYAmt",
        "ReturnData/IRS990/TotalLiabilitiesEndOfYearAmt",
    ],
    # --- org metadata ---
    "website": ["ReturnData/IRS990/WebsiteAddressTxt"],
    "formation_year": ["ReturnData/IRS990/FormationYr"],
    "total_employee_count": [
        "ReturnData/IRS990/TotalEmployeeCnt",
        "ReturnData/IRS990/TotalEmployeeCntCurrentYear",
    ],
    "mission_description": [
        "ReturnData/IRS990/ActivityOrMissionDesc",
        "ReturnData/IRS990/MissionDesc",
    ],
    "is_501c3": [
        "ReturnData/IRS990/Organization501c3Ind",
        "ReturnData/IRS990/Organization501c3",
    ],
    "gross_receipts": [
        "ReturnData/IRS990/GrossReceiptsAmt",
        "ReturnData/IRS990/GrossReceipts",
    ],
    "voting_members_count": [
        "ReturnData/IRS990/VotingMembersGoverningBodyCnt",
    ],
    "independent_voting_members_count": [
        "ReturnData/IRS990/VotingMembersIndependentCnt",
    ],
    # --- amended return marker ---
    "amended_return_ind": [
        "ReturnHeader/AmendedReturnInd",
    ],
}

# Numeric fields that should be coerced to int (or None on failure)
NUMERIC_FIELDS = frozenset({
    "total_revenue",
    "contributions_grants",
    "program_service_revenue",
    "investment_income",
    "other_revenue",
    "total_expenses",
    "revenues_less_expenses",
    "program_expenses",
    "total_functional_expenses",
    "net_assets_eoy",
    "total_assets_eoy",
    "total_liabilities_eoy",
    "total_employee_count",
    "gross_receipts",
    "voting_members_count",
    "independent_voting_members_count",
})


@dataclass(slots=True)
class ParseResult:
    """Result of parsing a single XML file."""

    source_path: str
    status: str  # "ok", "malformed", "not_990"
    error_message: str | None = None
    fields: dict[str, Any] = field(default_factory=dict)
    resolved_aliases: dict[str, str] = field(default_factory=dict)
    unresolved_fields: list[str] = field(default_factory=list)


def strip_namespaces(tree: ET.Element) -> None:
    """Remove all XML namespaces from element tags in-place."""
    for el in tree.iter():
        el.tag = NS_PATTERN.sub("", el.tag)
        el.attrib = {NS_PATTERN.sub("", k): v for k, v in el.attrib.items()}


def _find_text(root: ET.Element, path: str) -> str | None:
    """Find element by slash-separated path and return its text."""
    el = root.find(path)
    if el is not None and el.text:
        return el.text.strip()
    return None


def _coerce_int(value: str | None) -> int | None:
    """Best-effort integer coercion."""
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        # Handle negative values with formatting
        cleaned = value.replace(",", "").replace("$", "").strip()
        try:
            return int(cleaned)
        except (ValueError, TypeError):
            return None


def _coerce_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    lower = value.strip().lower()
    if lower in ("true", "1", "x", "yes"):
        return True
    if lower in ("false", "0", "no"):
        return False
    return None


def parse_990_xml(file_path: Path) -> ParseResult:
    """Parse a single IRS 990 XML file into canonical fields.

    Returns a ParseResult with status "ok" on success, "malformed" if the
    XML cannot be parsed, or "not_990" if the form type is not a full 990.
    """
    rel_path = str(file_path)

    try:
        tree = ET.parse(file_path)
    except ET.ParseError as exc:
        return ParseResult(
            source_path=rel_path,
            status="malformed",
            error_message=f"XML parse error: {exc}",
        )
    except Exception as exc:
        return ParseResult(
            source_path=rel_path,
            status="malformed",
            error_message=f"Unexpected error: {exc}",
        )

    root = tree.getroot()

    # Capture returnVersion before stripping namespaces
    return_version = root.attrib.get("returnVersion", None)
    # Also check namespaced version
    if return_version is None:
        for key, val in root.attrib.items():
            if key.endswith("returnVersion") or NS_PATTERN.sub("", key) == "returnVersion":
                return_version = val
                break

    strip_namespaces(root)

    # Check form type: only process full 990
    form_type = _find_text(root, "ReturnHeader/ReturnTypeCd")
    if form_type and form_type not in ("990",):
        return ParseResult(
            source_path=rel_path,
            status="not_990",
            error_message=f"Form type is '{form_type}', not full 990",
        )

    # Extract canonical fields
    fields: dict[str, Any] = {}
    resolved_aliases: dict[str, str] = {}
    unresolved: list[str] = []

    for canonical_name, aliases in CANONICAL_FIELD_MAP.items():
        if canonical_name == "return_version":
            fields["return_version"] = return_version
            if return_version is not None:
                resolved_aliases["return_version"] = "@returnVersion"
            continue

        value = None
        used_alias = None
        for alias in aliases:
            value = _find_text(root, alias)
            if value is not None:
                used_alias = alias
                break

        if value is not None:
            resolved_aliases[canonical_name] = used_alias  # type: ignore[assignment]

            if canonical_name in NUMERIC_FIELDS:
                fields[canonical_name] = _coerce_int(value)
            elif canonical_name in ("is_501c3",):
                fields[canonical_name] = _coerce_bool(value)
            else:
                fields[canonical_name] = value
        else:
            fields[canonical_name] = None
            unresolved.append(canonical_name)

    # Derive parse confidence based on resolved ratio
    total_fields = len(CANONICAL_FIELD_MAP)
    resolved_count = total_fields - len(unresolved)

    fields["parse_confidence"] = round(resolved_count / total_fields, 3) if total_fields > 0 else 0.0
    fields["source_path"] = rel_path
    fields["parse_status"] = "ok"

    return ParseResult(
        source_path=rel_path,
        status="ok",
        fields=fields,
        resolved_aliases=resolved_aliases,
        unresolved_fields=unresolved,
    )
