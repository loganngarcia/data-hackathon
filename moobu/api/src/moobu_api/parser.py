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
    OFFICERS_XPATH,
    PROFILE_FIELDS,
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


def _float(root: etree._Element, xpath: str) -> float | None:
    """Extract float from a single XPath match."""
    val = _text(root, xpath)
    if val is None:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def _child_text(el: etree._Element, local_name: str) -> str | None:
    """Get text of a child element by local name (ignoring namespace)."""
    for child in el:
        tag = child.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag == local_name:
            return child.text
    return None


def parse_990_xml(filepath: Path) -> list[dict[str, Any]]:
    """Parse a single 990 XML file into 1-2 filing records."""
    try:
        tree = etree.parse(str(filepath))
    except etree.XMLSyntaxError:
        return []

    root = tree.getroot()

    return_type = _text(root, HEADER_FIELDS["return_type"])
    if return_type not in ("990", None):
        return []

    irs990 = root.xpath("irs:ReturnData/irs:IRS990", namespaces=NS)
    if not irs990:
        return []

    ein = _text(root, HEADER_FIELDS["ein"])
    org_name = _text(root, HEADER_FIELDS["org_name"])
    tax_year_str = _text(root, HEADER_FIELDS["tax_year"])
    state = _text(root, HEADER_FIELDS["state"])

    if not ein or not tax_year_str:
        return []

    tax_year = int(tax_year_str)
    source_file = filepath.name
    records: list[dict[str, Any]] = []

    # Balance sheet
    net_assets_eoy = _int(root, BALANCE_FIELDS["net_assets_eoy"])
    net_assets_boy = _int(root, BALANCE_FIELDS["net_assets_boy"])

    # Expense breakdown
    program_expenses = _int(root, EXPENSE_FIELDS["program_expenses"])
    total_func_expenses = _int(root, EXPENSE_FIELDS["total_func_expenses"])

    # Profile fields
    mission_description = _text(root, PROFILE_FIELDS["mission_description"])
    website = _text(root, PROFILE_FIELDS["website"])
    formation_year = _int(root, PROFILE_FIELDS["formation_year"])
    employee_count = _int(root, PROFILE_FIELDS["employee_count"])
    volunteer_count = _int(root, PROFILE_FIELDS["volunteer_count"])

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
        "mission_description": mission_description,
        "website": website,
        "formation_year": formation_year,
        "employee_count": employee_count,
        "volunteer_count": volunteer_count,
    }
    for field_name, xpath in CY_FIELDS.items():
        cy_record[field_name] = _int(root, xpath)
    records.append(cy_record)

    # Prior Year record
    py_has_data = False
    py_record: dict[str, Any] = {
        "ein": ein,
        "org_name": org_name,
        "tax_year": tax_year - 1,
        "state": state,
        "form_type": "990",
        "filing_year": tax_year,
        "net_assets_eoy": net_assets_boy,
        "net_assets_boy": None,
        "program_expenses": None,
        "total_func_expenses": None,
        "source_file": source_file,
        "mission_description": mission_description,
        "website": website,
        "formation_year": formation_year,
        "employee_count": None,
        "volunteer_count": None,
    }
    for field_name, xpath in PY_FIELDS.items():
        val = _int(root, xpath)
        py_record[field_name] = val
        if val is not None:
            py_has_data = True

    if py_has_data:
        records.append(py_record)

    return records


def parse_officers(filepath: Path) -> list[dict[str, Any]]:
    """Parse officers/directors from a 990 XML file."""
    try:
        tree = etree.parse(str(filepath))
    except etree.XMLSyntaxError:
        return []

    root = tree.getroot()

    return_type = _text(root, HEADER_FIELDS["return_type"])
    if return_type not in ("990", None):
        return []

    ein = _text(root, HEADER_FIELDS["ein"])
    tax_year_str = _text(root, HEADER_FIELDS["tax_year"])
    if not ein or not tax_year_str:
        return []

    groups = root.xpath(OFFICERS_XPATH, namespaces=NS)
    officers: list[dict[str, Any]] = []

    for grp in groups:
        name = _child_text(grp, "PersonNm")
        if not name:
            continue

        title = _child_text(grp, "TitleTxt")
        hours_str = _child_text(grp, "AverageHoursPerWeekRt")
        comp_str = _child_text(grp, "ReportableCompFromOrgAmt")
        officer_ind = _child_text(grp, "OfficerInd")
        director_ind = _child_text(grp, "IndividualTrusteeOrDirectorInd")

        officers.append({
            "ein": ein,
            "person_name": name.title() if name else name,
            "title": title.title() if title else title,
            "avg_hours_per_week": float(hours_str) if hours_str else None,
            "compensation": int(comp_str) if comp_str else None,
            "is_officer": officer_ind in ("X", "1", "true"),
            "is_director": director_ind in ("X", "1", "true"),
            "filing_year": int(tax_year_str),
        })

    return officers
