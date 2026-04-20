"""Command line entrypoint for the hackathon pipeline."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

from .constants import (
    ARTIFACTS_DIR,
    FEATURES_DIR,
    INVENTORY_MANIFEST_PATH,
    NORMALIZED_DIR,
    RAW_DATA_DIR,
)
from .features import build_features
from .inventory import write_inventory_report
from .normalize import NormalizationError, normalize_corpus


def _json_dump(payload: object) -> str:
    return json.dumps(payload, indent=2, sort_keys=True, default=str)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="hackathon-pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)

    inv = subparsers.add_parser("inventory", help="Scan local raw XML files and write a manifest.")
    inv.add_argument("--raw-root", type=Path, default=RAW_DATA_DIR)
    inv.add_argument("--output", type=Path, default=INVENTORY_MANIFEST_PATH)

    norm = subparsers.add_parser("normalize", help="Parse 990 XML corpus into canonical tables.")
    norm.add_argument("--raw-root", type=Path, default=RAW_DATA_DIR)
    norm.add_argument("--output-dir", type=Path, default=NORMALIZED_DIR)

    feat = subparsers.add_parser("build-features", help="Compute analytical features from normalized panel.")
    feat.add_argument("--normalized-dir", type=Path, default=NORMALIZED_DIR)
    feat.add_argument("--output-dir", type=Path, default=FEATURES_DIR)

    score = subparsers.add_parser("score", help="Score organizations and assign risk bands.")
    score.add_argument("--features-dir", type=Path, default=FEATURES_DIR)
    score.add_argument("--output-dir", type=Path, default=FEATURES_DIR.parent / "scores")

    scen = subparsers.add_parser("scenarios", help="Run intervention scenarios for all organizations.")
    scen.add_argument("--features-dir", type=Path, default=FEATURES_DIR)
    scen.add_argument("--output-dir", type=Path, default=FEATURES_DIR.parent / "scenarios")

    art = subparsers.add_parser("generate-artifacts", help="Generate frontend-consumable JSON artifacts.")
    art.add_argument("--scores-dir", type=Path, default=FEATURES_DIR.parent / "scores")
    art.add_argument("--features-dir", type=Path, default=FEATURES_DIR)
    art.add_argument("--scenarios-dir", type=Path, default=FEATURES_DIR.parent / "scenarios")
    art.add_argument("--output-dir", type=Path, default=ARTIFACTS_DIR)

    pipe = subparsers.add_parser("run-all", help="Run the full pipeline: normalize -> features -> score -> scenarios -> artifacts.")
    pipe.add_argument("--raw-root", type=Path, default=RAW_DATA_DIR)

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

    if args.command == "score":
        from .scoring import score_portfolio
        print(_json_dump(score_portfolio(args.features_dir, args.output_dir)))
        return 0

    if args.command == "scenarios":
        from .scenarios import run_all_scenarios
        print(_json_dump(run_all_scenarios(args.features_dir, args.output_dir)))
        return 0

    if args.command == "generate-artifacts":
        from .artifacts import generate_artifacts
        print(_json_dump(generate_artifacts(
            args.scores_dir, args.features_dir, args.scenarios_dir, args.output_dir,
        )))
        return 0

    if args.command == "run-all":
        return _run_full_pipeline(args.raw_root)

    parser.error(f"Unknown command: {args.command}")
    return 2


def _run_full_pipeline(raw_root: Path) -> int:
    """Execute the full pipeline in order."""
    from .artifacts import generate_artifacts
    from .scenarios import run_all_scenarios
    from .scoring import score_portfolio

    processed = raw_root.parent / "processed"
    normalized_dir = processed / "normalized"
    features_dir = processed / "features"
    scores_dir = processed / "scores"
    scenarios_dir = processed / "scenarios"
    artifacts_dir = processed / "artifacts"

    steps = [
        ("normalize", lambda: normalize_corpus(raw_root, normalized_dir)),
        ("build-features", lambda: build_features(normalized_dir, features_dir)),
        ("score", lambda: score_portfolio(features_dir, scores_dir)),
        ("scenarios", lambda: run_all_scenarios(features_dir, scenarios_dir)),
        ("generate-artifacts", lambda: generate_artifacts(
            scores_dir, features_dir, scenarios_dir, artifacts_dir,
        )),
    ]

    for step_name, step_func in steps:
        print(f"\n{'='*60}")
        print(f"  Step: {step_name}")
        print(f"{'='*60}")
        try:
            result = step_func()
        except NormalizationError as exc:
            print(f"ERROR in {step_name}: {exc}", file=sys.stderr)
            return 1

        status = result.get("status", "unknown")
        if status == "error":
            print(f"ERROR in {step_name}: {result.get('message', 'unknown error')}", file=sys.stderr)
            return 1

        print(_json_dump(result))

    print(f"\n{'='*60}")
    print("  Pipeline complete!")
    print(f"{'='*60}")
    return 0
