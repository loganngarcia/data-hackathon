from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

PIPELINE_SRC = Path(__file__).resolve().parents[1] / "src"
if str(PIPELINE_SRC) not in sys.path:
    sys.path.insert(0, str(PIPELINE_SRC))

from hackathon_pipeline.inventory import scan_raw_xml_inventory, write_inventory_report


class InventoryTests(unittest.TestCase):
    def test_scan_raw_xml_inventory_counts_xml_files_and_infers_partitions(self) -> None:
        with self.subTest("setup"):
            raw_root = Path(self._tmpdir()) / "raw"
            (raw_root / "IRS990Data" / "XML Files" / "2025_990PF").mkdir(parents=True)
            (raw_root / "IRS990Data" / "XML Files" / "2025_990T").mkdir(parents=True)
            (raw_root / "IRS990Data" / "XML Files" / "2025_990PF" / "alpha.xml").write_text("<xml />", encoding="utf-8")
            (raw_root / "IRS990Data" / "XML Files" / "2025_990T" / "beta.xml").write_text("<xml />", encoding="utf-8")
            (raw_root / "IRS990Data" / "XML Files" / "2025_990T" / "notes.txt").write_text("skip me", encoding="utf-8")

        report = scan_raw_xml_inventory(raw_root)

        self.assertTrue(report.exists)
        self.assertEqual(report.summary["xml_file_count"], 2)
        self.assertEqual(report.summary["years"], [2025])
        self.assertEqual(report.summary["forms"], ["990PF", "990T"])
        self.assertEqual(report.summary["year_counts"], {2025: 2})
        self.assertEqual(report.summary["form_counts"], {"990PF": 1, "990T": 1})
        self.assertEqual(
            [file.relative_path for file in report.files],
            [
                "IRS990Data/XML Files/2025_990PF/alpha.xml",
                "IRS990Data/XML Files/2025_990T/beta.xml",
            ],
        )
        self.assertEqual(report.files[0].inferred_year, 2025)
        self.assertEqual(report.files[0].inferred_form, "990PF")
        self.assertEqual(report.files[1].inferred_year, 2025)
        self.assertEqual(report.files[1].inferred_form, "990T")

    def test_write_inventory_report_emits_json_manifest(self) -> None:
        raw_root = Path(self._tmpdir()) / "raw"
        output_path = Path(self._tmpdir()) / "manifests" / "raw_inventory.json"
        (raw_root / "IRS990Data" / "XML Files" / "2024_990PF").mkdir(parents=True)
        (raw_root / "IRS990Data" / "XML Files" / "2024_990PF" / "alpha.xml").write_text("<xml />", encoding="utf-8")

        report = write_inventory_report(raw_root, output_path)
        manifest = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertTrue(output_path.exists())
        self.assertEqual(manifest["raw_root"], str(raw_root))
        self.assertEqual(manifest["summary"]["xml_file_count"], 1)
        self.assertTrue(manifest["files"][0]["relative_path"].endswith("alpha.xml"))
        self.assertEqual(report.summary["xml_file_count"], 1)

    def _tmpdir(self) -> str:
        if not hasattr(self, "_cached_tmpdir"):
            from tempfile import TemporaryDirectory

            self._cached_tmpdir = TemporaryDirectory()
            self.addCleanup(self._cached_tmpdir.cleanup)
        return self._cached_tmpdir.name


if __name__ == "__main__":
    unittest.main()
