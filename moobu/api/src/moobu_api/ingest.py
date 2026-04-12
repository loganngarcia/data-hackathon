"""Ingest IRS 990 XML files into DuckDB."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

from .db import get_db, init_tables
from .parser import parse_990_xml
from .schema import FILING_COLUMNS

DEFAULT_RAW_DIR = Path(__file__).resolve().parents[3] / "data" / "raw"


def find_990_xml_files(raw_dir: Path) -> list[Path]:
    """Find all XML files in directories containing full 990 filings."""
    xml_files: list[Path] = []
    for xml_path in sorted(raw_dir.rglob("*.xml")):
        if xml_path.is_file():
            xml_files.append(xml_path)
    return xml_files


def ingest_all(raw_dir: Path | None = None, db_path: Path | None = None) -> dict:
    """Parse all XML files and load into DuckDB.

    Returns a summary dict with counts.
    """
    raw = raw_dir or DEFAULT_RAW_DIR
    db = get_db(db_path)
    init_tables(db)

    xml_files = find_990_xml_files(raw)
    print(f"Found {len(xml_files)} XML files")

    all_records: list[dict] = []
    parsed = 0
    skipped = 0
    errors = 0

    for i, filepath in enumerate(xml_files):
        if (i + 1) % 500 == 0:
            print(f"  Parsed {i + 1}/{len(xml_files)} files...")
        try:
            records = parse_990_xml(filepath)
            if records:
                all_records.extend(records)
                parsed += 1
            else:
                skipped += 1
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error parsing {filepath.name}: {e}", file=sys.stderr)

    print(f"Parsed {parsed} files, skipped {skipped}, errors {errors}")
    print(f"Total records: {len(all_records)}")

    if not all_records:
        return {"parsed": parsed, "skipped": skipped, "errors": errors, "records": 0}

    # Build DataFrame and deduplicate
    df = pd.DataFrame(all_records)

    # Ensure all expected columns exist
    for col in FILING_COLUMNS:
        if col not in df.columns:
            df[col] = None

    df = df[FILING_COLUMNS]

    # Dedup: keep the record from the latest filing_year per (ein, tax_year)
    df = df.sort_values("filing_year", ascending=False)
    df = df.drop_duplicates(subset=["ein", "tax_year"], keep="first")
    df = df.sort_values(["ein", "tax_year"])

    print(f"After dedup: {len(df)} records, {df['ein'].nunique()} unique orgs")

    # Load into DuckDB
    db.execute("DELETE FROM filings")
    db.execute("INSERT INTO filings SELECT * FROM df")

    # Verify
    count = db.execute("SELECT COUNT(*) FROM filings").fetchone()[0]
    unique_eins = db.execute("SELECT COUNT(DISTINCT ein) FROM filings").fetchone()[0]

    summary = {
        "parsed": parsed,
        "skipped": skipped,
        "errors": errors,
        "records": count,
        "unique_orgs": unique_eins,
    }
    print(f"Loaded {count} records into DuckDB ({unique_eins} unique orgs)")
    return summary


if __name__ == "__main__":
    ingest_all()
