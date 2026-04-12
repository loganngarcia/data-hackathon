#!/usr/bin/env python3
"""Thin wrapper for the hackathon pipeline CLI."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "pipeline" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from hackathon_pipeline.cli import main


if __name__ == "__main__":
    raise SystemExit(main())
