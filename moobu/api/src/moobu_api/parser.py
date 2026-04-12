"""Parse IRS 990 XML files into structured records."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from lxml import etree

from .schema import (
    BALANCE_FIELDS,
    CY_FIELDS,
    EXPENSE_FIELDS,
    HEADER_FIELDS,
    NS,
    PY_FIELDS,
)


def _text(root: etree._Element, xpath: str) -> str | None:
    """Extract text from a single XPath match."""
    elements = root.xpath(xpath, namespaces=NS)
    if elements:
        return elements[0].text
    return None


def _int(root: etree._Element, xpath: str) -> int | None:
    """Extract integer from a single XPath match."""
    val = _text(root, xpath)
    if val is None:
        return None
    try:
        return int(val)
    except ValueError:
        return None


def parse_990_xml(filepath: Path) -> list[dict[str, Any]]:
    """Parse a single 990 XML file into 1-2 filing records.

    Returns a list because each filing can produce both a current-year
    and a prior-year record.
    """
    try:
        tree = etree.parse(str(filepath))
    except etree.XMLSyntaxError:
        return []

    root = tree.getroot()

    # Check it's a full 990 (not 990T, 990PF, etc.)
    return_type = _text(root, HEADER_FIELDS["return_type"])
    if return_type not in ("990", None):
        return []

    # Also verify IRS990 element exists
    irs990 = root.xpath("irs:ReturnData/irs:IRS990", namespaces=NS)
    if not irs990:
        return []

    # Extract header fields
    ein = _text(root, HEADER_FIELDS["ein"])
    org_name = _text(root, HEADER_FIELDS["org_name"])
    tax_year_str = _text(root, HEADER_FIELDS["tax_year"])
    state = _text(root, HEADER_FIELDS["state"])

    if not ein or not tax_year_str:
        return []

    tax_year = int(tax_year_str)
    source_file = filepath.name
    records: list[dict[str, Any]] = []

    # Balance sheet fields (end-of-year snapshot)
    net_assets_eoy = _int(root, BALANCE_FIELDS["net_assets_eoy"])
    net_assets_boy = _int(root, BALANCE_FIELDS["net_assets_boy"])

    # Expense breakdown
    program_expenses = _int(root, EXPENSE_FIELDS["program_expenses"])
    total_func_expenses = _int(root, EXPENSE_FIELDS["total_func_expenses"])

    # Current Year record
    cy_record: dict[str, Any] = {
        "ein": ein,
        "org_name": org_name,
        "tax_year": tax_year,
        "state": state,
        "form_type": "990",
        "filing_year": tax_year,
        "net_assets_eoy": net_assets_eoy,
        "net_assets_boy": net_assets_boy,
        "program_expenses": program_expenses,
        "total_func_expenses": total_func_expenses,
        "source_file": source_file,
    }
    for field_name, xpath in CY_FIELDS.items():
        cy_record[field_name] = _int(root, xpath)
    records.append(cy_record)

    # Prior Year record (tax_year - 1)
    py_has_data = False
    py_record: dict[str, Any] = {
        "ein": ein,
        "org_name": org_name,
        "tax_year": tax_year - 1,
        "state": state,
        "form_type": "990",
        "filing_year": tax_year,
        "net_assets_eoy": net_assets_boy,  # BOY of CY = EOY of PY
        "net_assets_boy": None,
        "program_expenses": None,
        "total_func_expenses": None,
        "source_file": source_file,
    }
    for field_name, xpath in PY_FIELDS.items():
        val = _int(root, xpath)
        py_record[field_name] = val
        if val is not None:
            py_has_data = True

    if py_has_data:
        records.append(py_record)

    return records
