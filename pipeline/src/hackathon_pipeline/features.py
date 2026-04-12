"""Stub feature engineering step for the future analytical panel."""

from __future__ import annotations

from pathlib import Path
from typing import Any


def build_features(normalized_dir: Path, output_dir: Path) -> dict[str, Any]:
    """Placeholder feature build step.

    The eventual implementation will consume normalized org-year outputs and
    write feature tables under data/processed. This stub keeps the command
    surface in place without pretending feature engineering is complete.
    """

    return {
        "status": "stubbed",
        "step": "build-features",
        "normalized_dir": str(normalized_dir),
        "output_dir": str(output_dir),
        "message": "Feature generation is not implemented yet; wait for normalized outputs before building the panel.",
    }
