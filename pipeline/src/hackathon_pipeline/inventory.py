"""Inventory local raw XML files and emit a manifest-style report."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .constants import DEFAULT_XML_SUFFIX

PARTITION_PATTERN = re.compile(r"^(?P<year>\d{4})_(?P<form>[A-Za-z0-9]+)$")


@dataclass(slots=True)
class InventoryFile:
    relative_path: str
    size_bytes: int
    modified_at: str
    inferred_year: int | None
    inferred_form: str | None


@dataclass(slots=True)
class InventoryDirectory:
    relative_path: str
    xml_file_count: int
    total_bytes: int


@dataclass(slots=True)
class InventoryReport:
    generated_at: str
    raw_root: str
    exists: bool
    summary: dict[str, Any] = field(default_factory=dict)
    directories: list[InventoryDirectory] = field(default_factory=list)
    files: list[InventoryFile] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "generated_at": self.generated_at,
            "raw_root": self.raw_root,
            "exists": self.exists,
            "summary": self.summary,
            "directories": [asdict(directory) for directory in self.directories],
            "files": [asdict(file) for file in self.files],
            "notes": self.notes,
        }

    def to_json(self, *, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, sort_keys=True)


def infer_partition_metadata(path: Path) -> tuple[int | None, str | None]:
    for part in path.parts:
        match = PARTITION_PATTERN.match(part)
        if match:
            return int(match.group("year")), match.group("form")
    return None, None


def _utc_timestamp(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()


def scan_raw_xml_inventory(raw_root: Path) -> InventoryReport:
    raw_root = raw_root.expanduser()
    generated_at = datetime.now(tz=timezone.utc).isoformat()

    if not raw_root.exists():
        return InventoryReport(
            generated_at=generated_at,
            raw_root=str(raw_root),
            exists=False,
            summary={
                "xml_file_count": 0,
                "directory_count": 0,
                "total_bytes": 0,
                "years": [],
                "forms": [],
                "partitioned_directories": 0,
            },
            notes=[
                "Raw XML directory does not exist yet.",
                "Mirror the Drive corpus into the raw root before normalization.",
            ],
        )

    files: list[InventoryFile] = []
    directory_totals: dict[str, dict[str, int]] = defaultdict(lambda: {"xml_file_count": 0, "total_bytes": 0})
    year_counter: Counter[int] = Counter()
    form_counter: Counter[str] = Counter()
    total_bytes = 0

    for file_path in sorted(raw_root.rglob(f"*{DEFAULT_XML_SUFFIX}")):
        if not file_path.is_file():
            continue

        relative_path = file_path.relative_to(raw_root)
        inferred_year, inferred_form = infer_partition_metadata(relative_path)
        size_bytes = file_path.stat().st_size
        total_bytes += size_bytes

        files.append(
            InventoryFile(
                relative_path=str(relative_path),
                size_bytes=size_bytes,
                modified_at=_utc_timestamp(file_path),
                inferred_year=inferred_year,
                inferred_form=inferred_form,
            )
        )

        directory_key = str(relative_path.parent)
        directory_totals[directory_key]["xml_file_count"] += 1
        directory_totals[directory_key]["total_bytes"] += size_bytes

        if inferred_year is not None:
            year_counter[inferred_year] += 1
        if inferred_form is not None:
            form_counter[inferred_form] += 1

    directories = [
        InventoryDirectory(
            relative_path=directory,
            xml_file_count=totals["xml_file_count"],
            total_bytes=totals["total_bytes"],
        )
        for directory, totals in sorted(directory_totals.items())
    ]

    return InventoryReport(
        generated_at=generated_at,
        raw_root=str(raw_root),
        exists=True,
        summary={
            "xml_file_count": len(files),
            "directory_count": len(directories),
            "total_bytes": total_bytes,
            "years": sorted(year_counter.keys()),
            "forms": sorted(form_counter.keys()),
            "year_counts": dict(sorted(year_counter.items())),
            "form_counts": dict(sorted(form_counter.items())),
            "partitioned_directories": sum(1 for directory in directories if PARTITION_PATTERN.match(directory.relative_path)),
        },
        directories=directories,
        files=files,
        notes=[
            "This inventory is intentionally local-only and scans data/raw recursively.",
            "The Drive source should be mirrored into data/raw/IRS990Data/XML Files/<year>_<form>/...",
        ],
    )


def write_inventory_report(raw_root: Path, output_path: Path) -> InventoryReport:
    report = scan_raw_xml_inventory(raw_root)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report.to_json() + "\n", encoding="utf-8")
    return report
