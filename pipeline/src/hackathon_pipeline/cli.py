"""Command line entrypoint for the hackathon pipeline scaffold."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

from .constants import INVENTORY_MANIFEST_PATH, NORMALIZED_DIR, RAW_DATA_DIR, FEATURES_DIR
from .features import build_features
from .inventory import write_inventory_report
from .normalize import NormalizationError, normalize_corpus


def _json_dump(payload: object) -> str:
    return json.dumps(payload, indent=2, sort_keys=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="hackathon-pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)

    inventory_parser = subparsers.add_parser("inventory", help="Scan local raw XML files and write a manifest.")
    inventory_parser.add_argument("--raw-root", type=Path, default=RAW_DATA_DIR)
    inventory_parser.add_argument("--output", type=Path, default=INVENTORY_MANIFEST_PATH)

    normalize_parser = subparsers.add_parser("normalize", help="Parse 990 XML corpus into canonical tables.")
    normalize_parser.add_argument("--raw-root", type=Path, default=RAW_DATA_DIR)
    normalize_parser.add_argument("--output-dir", type=Path, default=NORMALIZED_DIR)

    features_parser = subparsers.add_parser("build-features", help="Placeholder feature engineering step.")
    features_parser.add_argument("--normalized-dir", type=Path, default=NORMALIZED_DIR)
    features_parser.add_argument("--output-dir", type=Path, default=FEATURES_DIR)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "inventory":
        report = write_inventory_report(args.raw_root, args.output)
        print(report.to_json())
        return 0

    if args.command == "normalize":
        try:
            result = normalize_corpus(args.raw_root, args.output_dir)
        except NormalizationError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
        print(_json_dump(result))
        return 0

    if args.command == "build-features":
        print(_json_dump(build_features(args.normalized_dir, args.output_dir)))
        return 0

    parser.error(f"Unknown command: {args.command}")
    return 2
