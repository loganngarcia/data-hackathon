"""Stub normalize step for the future XML-to-canonical-table pipeline."""

from __future__ import annotations

from pathlib import Path
from typing import Any


def normalize_corpus(raw_root: Path, output_dir: Path) -> dict[str, Any]:
    """Placeholder normalize step.

    The real implementation will parse the mirrored Drive XML corpus under
    ``data/raw`` and emit a canonical org-year table plus a normalization
    manifest. For now, this returns a structured TODO-safe response so the
    CLI stays usable while the ingestion contract is finalized.
    """

    return {
        "status": "stubbed",
        "step": "normalize",
        "raw_root": str(raw_root),
        "output_dir": str(output_dir),
        "message": "Normalization is not implemented yet; use inventory to confirm raw XML coverage first.",
    }
