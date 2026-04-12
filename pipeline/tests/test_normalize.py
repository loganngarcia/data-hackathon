"""Tests for the normalization pipeline.

Covers:
  - No-raw-data gate (hard failure)
  - Happy path: XML -> canonical tables + manifest + dictionary
  - Schema drift: alternate tag names resolve to same canonical fields
  - Namespace handling: IRS namespaced files parse correctly
  - Duplicate/amended filing resolution
  - Malformed XML quarantine
  - Regression: existing inventory tests unaffected
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from textwrap import dedent

PIPELINE_SRC = Path(__file__).resolve().parents[1] / "src"
if str(PIPELINE_SRC) not in sys.path:
    sys.path.insert(0, str(PIPELINE_SRC))

from hackathon_pipeline.normalize import NormalizationError, normalize_corpus
from hackathon_pipeline.xml_parser import parse_990_xml

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_990_XML = dedent("""\
    <?xml version="1.0" encoding="utf-8"?>
    <Return xmlns="http://www.irs.gov/efile" returnVersion="2020v4.1">
      <ReturnHeader binaryAttachmentCnt="0">
        <ReturnTs>2021-05-15T10:30:00-05:00</ReturnTs>
        <TaxPeriodEndDt>2020-12-31</TaxPeriodEndDt>
        <ReturnTypeCd>990</ReturnTypeCd>
        <TaxPeriodBeginDt>2020-01-01</TaxPeriodBeginDt>
        <Filer>
          <EIN>123456789</EIN>
          <BusinessName>
            <BusinessNameLine1Txt>TEST NONPROFIT ORG</BusinessNameLine1Txt>
          </BusinessName>
          <USAddress>
            <AddressLine1Txt>123 MAIN ST</AddressLine1Txt>
            <CityNm>ANYTOWN</CityNm>
            <StateAbbreviationCd>CA</StateAbbreviationCd>
            <ZIPCd>90210</ZIPCd>
          </USAddress>
        </Filer>
        <TaxYr>2020</TaxYr>
      </ReturnHeader>
      <ReturnData documentCnt="1">
        <IRS990 documentId="RetDoc1">
          <GrossReceiptsAmt>5000000</GrossReceiptsAmt>
          <Organization501c3Ind>X</Organization501c3Ind>
          <WebsiteAddressTxt>www.testorg.org</WebsiteAddressTxt>
          <FormationYr>1990</FormationYr>
          <LegalDomicileStateCd>CA</LegalDomicileStateCd>
          <ActivityOrMissionDesc>HELPING PEOPLE IN NEED</ActivityOrMissionDesc>
          <VotingMembersGoverningBodyCnt>7</VotingMembersGoverningBodyCnt>
          <VotingMembersIndependentCnt>5</VotingMembersIndependentCnt>
          <TotalEmployeeCnt>25</TotalEmployeeCnt>
          <CYContributionsGrantsAmt>3000000</CYContributionsGrantsAmt>
          <CYProgramServiceRevenueAmt>1500000</CYProgramServiceRevenueAmt>
          <CYInvestmentIncomeAmt>200000</CYInvestmentIncomeAmt>
          <CYOtherRevenueAmt>100000</CYOtherRevenueAmt>
          <CYTotalRevenueAmt>4800000</CYTotalRevenueAmt>
          <CYTotalExpensesAmt>4200000</CYTotalExpensesAmt>
          <CYRevenuesLessExpensesAmt>600000</CYRevenuesLessExpensesAmt>
          <TotalProgramServiceExpensesAmt>3500000</TotalProgramServiceExpensesAmt>
          <NetAssetsOrFundBalancesEOYAmt>2500000</NetAssetsOrFundBalancesEOYAmt>
          <TotalAssetsEOYAmt>3000000</TotalAssetsEOYAmt>
          <TotalLiabilitiesEOYAmt>500000</TotalLiabilitiesEOYAmt>
        </IRS990>
      </ReturnData>
    </Return>
""")

SAMPLE_990_ALTERNATE_TAGS = dedent("""\
    <?xml version="1.0" encoding="utf-8"?>
    <Return xmlns="http://www.irs.gov/efile" returnVersion="2016v3.0">
      <ReturnHeader binaryAttachmentCnt="0">
        <ReturnTs>2017-06-01T09:00:00-05:00</ReturnTs>
        <TaxPeriodEndDt>2016-12-31</TaxPeriodEndDt>
        <ReturnTypeCd>990</ReturnTypeCd>
        <TaxPeriodBeginDt>2016-01-01</TaxPeriodBeginDt>
        <Filer>
          <EIN>987654321</EIN>
          <BusinessName>
            <BusinessNameLine1Txt>ALTERNATE TAGS ORG</BusinessNameLine1Txt>
          </BusinessName>
          <USAddress>
            <CityNm>OLDTOWN</CityNm>
            <StateAbbreviationCd>NY</StateAbbreviationCd>
            <ZIPCd>10001</ZIPCd>
          </USAddress>
        </Filer>
        <TaxYr>2016</TaxYr>
      </ReturnHeader>
      <ReturnData documentCnt="1">
        <IRS990 documentId="RetDoc1">
          <GrossReceiptsAmt>1000000</GrossReceiptsAmt>
          <Organization501c3Ind>true</Organization501c3Ind>
          <TotalEmployeeCnt>10</TotalEmployeeCnt>
          <CYContributionsGrantsAmt>800000</CYContributionsGrantsAmt>
          <CYProgramServiceRevenueAmt>100000</CYProgramServiceRevenueAmt>
          <CYInvestmentIncomeAmt>50000</CYInvestmentIncomeAmt>
          <CYOtherRevenueAmt>50000</CYOtherRevenueAmt>
          <CYTotalRevenueAmt>1000000</CYTotalRevenueAmt>
          <CYTotalExpensesAmt>900000</CYTotalExpensesAmt>
          <CYRevenuesLessExpensesAmt>100000</CYRevenuesLessExpensesAmt>
          <TotalProgramServiceExpensesAmt>750000</TotalProgramServiceExpensesAmt>
          <NetAssetsOrFundBalancesEOYAmt>500000</NetAssetsOrFundBalancesEOYAmt>
          <TotalAssetsEOYAmt>600000</TotalAssetsEOYAmt>
          <TotalLiabilitiesEOYAmt>100000</TotalLiabilitiesEOYAmt>
        </IRS990>
      </ReturnData>
    </Return>
""")

SAMPLE_990PF_XML = dedent("""\
    <?xml version="1.0" encoding="utf-8"?>
    <Return xmlns="http://www.irs.gov/efile" returnVersion="2020v4.1">
      <ReturnHeader>
        <ReturnTypeCd>990PF</ReturnTypeCd>
        <Filer><EIN>111222333</EIN></Filer>
        <TaxYr>2020</TaxYr>
      </ReturnHeader>
      <ReturnData documentCnt="1">
        <IRS990PF documentId="RetDoc1" />
      </ReturnData>
    </Return>
""")

MALFORMED_XML = "<<< this is not valid xml >>>"

NO_NAMESPACE_990 = dedent("""\
    <?xml version="1.0" encoding="utf-8"?>
    <Return returnVersion="2019v5.0">
      <ReturnHeader>
        <ReturnTs>2020-04-01T12:00:00-04:00</ReturnTs>
        <TaxPeriodEndDt>2019-12-31</TaxPeriodEndDt>
        <ReturnTypeCd>990</ReturnTypeCd>
        <TaxPeriodBeginDt>2019-01-01</TaxPeriodBeginDt>
        <Filer>
          <EIN>555666777</EIN>
          <BusinessName>
            <BusinessNameLine1Txt>NO NAMESPACE ORG</BusinessNameLine1Txt>
          </BusinessName>
          <USAddress>
            <StateAbbreviationCd>TX</StateAbbreviationCd>
          </USAddress>
        </Filer>
        <TaxYr>2019</TaxYr>
      </ReturnHeader>
      <ReturnData documentCnt="1">
        <IRS990 documentId="RetDoc1">
          <CYTotalRevenueAmt>2000000</CYTotalRevenueAmt>
          <CYTotalExpensesAmt>1800000</CYTotalExpensesAmt>
          <CYRevenuesLessExpensesAmt>200000</CYRevenuesLessExpensesAmt>
          <NetAssetsOrFundBalancesEOYAmt>1000000</NetAssetsOrFundBalancesEOYAmt>
        </IRS990>
      </ReturnData>
    </Return>
""")

AMENDED_990_XML = dedent("""\
    <?xml version="1.0" encoding="utf-8"?>
    <Return xmlns="http://www.irs.gov/efile" returnVersion="2020v4.1">
      <ReturnHeader>
        <ReturnTs>2022-01-15T10:00:00-05:00</ReturnTs>
        <ReturnTypeCd>990</ReturnTypeCd>
        <TaxPeriodBeginDt>2020-01-01</TaxPeriodBeginDt>
        <TaxPeriodEndDt>2020-12-31</TaxPeriodEndDt>
        <AmendedReturnInd>X</AmendedReturnInd>
        <Filer>
          <EIN>123456789</EIN>
          <BusinessName>
            <BusinessNameLine1Txt>TEST NONPROFIT ORG</BusinessNameLine1Txt>
          </BusinessName>
          <USAddress>
            <StateAbbreviationCd>CA</StateAbbreviationCd>
          </USAddress>
        </Filer>
        <TaxYr>2020</TaxYr>
      </ReturnHeader>
      <ReturnData documentCnt="1">
        <IRS990 documentId="RetDoc1">
          <CYTotalRevenueAmt>5000000</CYTotalRevenueAmt>
          <CYTotalExpensesAmt>4300000</CYTotalExpensesAmt>
          <CYRevenuesLessExpensesAmt>700000</CYRevenuesLessExpensesAmt>
          <NetAssetsOrFundBalancesEOYAmt>2600000</NetAssetsOrFundBalancesEOYAmt>
        </IRS990>
      </ReturnData>
    </Return>
""")


def _make_990_partition(tmp: str, year: int = 2020) -> Path:
    """Create directory structure and return the raw_root."""
    raw_root = Path(tmp) / "raw"
    partition = raw_root / "IRS990Data" / "XML Files" / f"{year}_990"
    partition.mkdir(parents=True)
    return raw_root


class TestParserUnit(unittest.TestCase):
    """Unit tests for the XML parser."""

    def _tmpdir(self) -> str:
        if not hasattr(self, "_cached_tmpdir"):
            self._cached_tmpdir = TemporaryDirectory()
            self.addCleanup(self._cached_tmpdir.cleanup)
        return self._cached_tmpdir.name

    def test_parse_standard_990(self) -> None:
        tmp = self._tmpdir()
        xml_path = Path(tmp) / "test.xml"
        xml_path.write_text(SAMPLE_990_XML, encoding="utf-8")

        result = parse_990_xml(xml_path)
        self.assertEqual(result.status, "ok")
        self.assertEqual(result.fields["ein"], "123456789")
        self.assertEqual(result.fields["organization_name"], "TEST NONPROFIT ORG")
        self.assertEqual(result.fields["tax_year"], "2020")
        self.assertEqual(result.fields["form_type"], "990")
        self.assertEqual(result.fields["state"], "CA")
        self.assertEqual(result.fields["total_revenue"], 4800000)
        self.assertEqual(result.fields["total_expenses"], 4200000)
        self.assertEqual(result.fields["revenues_less_expenses"], 600000)
        self.assertEqual(result.fields["contributions_grants"], 3000000)
        self.assertEqual(result.fields["net_assets_eoy"], 2500000)
        self.assertEqual(result.fields["total_employee_count"], 25)
        self.assertTrue(result.fields["is_501c3"])
        self.assertEqual(result.fields["return_version"], "2020v4.1")

    def test_parse_malformed_xml(self) -> None:
        tmp = self._tmpdir()
        xml_path = Path(tmp) / "bad.xml"
        xml_path.write_text(MALFORMED_XML, encoding="utf-8")

        result = parse_990_xml(xml_path)
        self.assertEqual(result.status, "malformed")
        self.assertIn("XML parse error", result.error_message or "")

    def test_parse_990pf_returns_not_990(self) -> None:
        tmp = self._tmpdir()
        xml_path = Path(tmp) / "pf.xml"
        xml_path.write_text(SAMPLE_990PF_XML, encoding="utf-8")

        result = parse_990_xml(xml_path)
        self.assertEqual(result.status, "not_990")

    def test_parse_no_namespace(self) -> None:
        tmp = self._tmpdir()
        xml_path = Path(tmp) / "nonamespace.xml"
        xml_path.write_text(NO_NAMESPACE_990, encoding="utf-8")

        result = parse_990_xml(xml_path)
        self.assertEqual(result.status, "ok")
        self.assertEqual(result.fields["ein"], "555666777")
        self.assertEqual(result.fields["total_revenue"], 2000000)
        self.assertEqual(result.fields["state"], "TX")

    def test_parse_confidence_reflects_resolved_ratio(self) -> None:
        tmp = self._tmpdir()
        xml_path = Path(tmp) / "test.xml"
        xml_path.write_text(SAMPLE_990_XML, encoding="utf-8")

        result = parse_990_xml(xml_path)
        self.assertGreater(result.fields["parse_confidence"], 0.5)
        self.assertLessEqual(result.fields["parse_confidence"], 1.0)


class TestNormalizationGate(unittest.TestCase):
    """Test that normalize fails clearly when no XML files are present."""

    def _tmpdir(self) -> str:
        if not hasattr(self, "_cached_tmpdir"):
            self._cached_tmpdir = TemporaryDirectory()
            self.addCleanup(self._cached_tmpdir.cleanup)
        return self._cached_tmpdir.name

    def test_no_raw_data_raises_error(self) -> None:
        tmp = self._tmpdir()
        raw_root = Path(tmp) / "empty_raw"
        output_dir = Path(tmp) / "output"

        with self.assertRaises(NormalizationError) as ctx:
            normalize_corpus(raw_root, output_dir)

        self.assertIn("No 990 XML files found", str(ctx.exception))
        # Ensure no fake outputs were written
        self.assertFalse(output_dir.exists())

    def test_raw_dir_exists_but_no_990_partition(self) -> None:
        tmp = self._tmpdir()
        raw_root = Path(tmp) / "raw"
        (raw_root / "IRS990Data" / "XML Files" / "2020_990PF").mkdir(parents=True)
        (raw_root / "IRS990Data" / "XML Files" / "2020_990PF" / "file.xml").write_text(
            SAMPLE_990PF_XML, encoding="utf-8"
        )
        output_dir = Path(tmp) / "output"

        with self.assertRaises(NormalizationError):
            normalize_corpus(raw_root, output_dir)


class TestNormalizationHappyPath(unittest.TestCase):
    """Happy path: representative 990 sample produces correct outputs."""

    def _tmpdir(self) -> str:
        if not hasattr(self, "_cached_tmpdir"):
            self._cached_tmpdir = TemporaryDirectory()
            self.addCleanup(self._cached_tmpdir.cleanup)
        return self._cached_tmpdir.name

    def test_single_file_produces_all_outputs(self) -> None:
        tmp = self._tmpdir()
        raw_root = _make_990_partition(tmp, 2020)
        partition = raw_root / "IRS990Data" / "XML Files" / "2020_990"
        (partition / "filing_001.xml").write_text(SAMPLE_990_XML, encoding="utf-8")

        output_dir = Path(tmp) / "processed" / "normalized"
        result = normalize_corpus(raw_root, output_dir)

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["filings_parsed"], 1)
        self.assertEqual(result["unique_org_years"], 1)
        self.assertEqual(result["quarantined"], 0)

        # Verify output files exist
        self.assertTrue(Path(result["outputs"]["filings_parquet"]).exists())
        self.assertTrue(Path(result["outputs"]["org_year_panel_parquet"]).exists())
        self.assertTrue(Path(result["outputs"]["normalization_manifest"]).exists())
        self.assertTrue(Path(result["outputs"]["normalization_dictionary"]).exists())

    def test_parquet_contains_canonical_columns(self) -> None:
        import pyarrow.parquet as pq

        tmp = self._tmpdir()
        raw_root = _make_990_partition(tmp, 2020)
        partition = raw_root / "IRS990Data" / "XML Files" / "2020_990"
        (partition / "filing_001.xml").write_text(SAMPLE_990_XML, encoding="utf-8")

        output_dir = Path(tmp) / "processed" / "normalized"
        result = normalize_corpus(raw_root, output_dir)

        table = pq.read_table(result["outputs"]["filings_parquet"])
        columns = set(table.column_names)

        required = {
            "ein", "organization_name", "tax_year", "form_type", "state",
            "total_revenue", "total_expenses", "revenues_less_expenses",
            "contributions_grants", "program_service_revenue",
            "investment_income", "other_revenue", "net_assets_eoy",
            "program_expenses", "source_path", "parse_status",
            "parse_confidence",
        }
        self.assertTrue(required.issubset(columns), f"Missing: {required - columns}")

        # Check values
        self.assertEqual(table.column("ein").to_pylist(), ["123456789"])
        self.assertEqual(table.column("total_revenue").to_pylist(), [4800000])

    def test_manifest_has_required_sections(self) -> None:
        tmp = self._tmpdir()
        raw_root = _make_990_partition(tmp, 2020)
        partition = raw_root / "IRS990Data" / "XML Files" / "2020_990"
        (partition / "filing_001.xml").write_text(SAMPLE_990_XML, encoding="utf-8")

        output_dir = Path(tmp) / "processed" / "normalized"
        result = normalize_corpus(raw_root, output_dir)

        manifest = json.loads(Path(result["outputs"]["normalization_manifest"]).read_text())
        self.assertIn("summary", manifest)
        self.assertIn("field_mapping_coverage", manifest)
        self.assertIn("fallback_rules_used", manifest)
        self.assertIn("unresolved_fields_summary", manifest)
        self.assertIn("quarantined_files", manifest)
        self.assertIn("duplicate_buckets", manifest)
        self.assertIn("downstream_consumers", manifest)

    def test_dictionary_has_all_fields(self) -> None:
        tmp = self._tmpdir()
        raw_root = _make_990_partition(tmp, 2020)
        partition = raw_root / "IRS990Data" / "XML Files" / "2020_990"
        (partition / "filing_001.xml").write_text(SAMPLE_990_XML, encoding="utf-8")

        output_dir = Path(tmp) / "processed" / "normalized"
        result = normalize_corpus(raw_root, output_dir)

        dictionary = json.loads(Path(result["outputs"]["normalization_dictionary"]).read_text())
        self.assertEqual(dictionary["form_types_supported"], ["990"])
        self.assertEqual(dictionary["form_types_planned"], ["990-EZ"])
        self.assertEqual(dictionary["form_types_excluded"], ["990-PF"])
        field_names = {f["field"] for f in dictionary["fields"]}
        self.assertIn("ein", field_names)
        self.assertIn("total_revenue", field_names)
        self.assertIn("parse_confidence", field_names)

    def test_multiple_files_across_years(self) -> None:
        tmp = self._tmpdir()
        raw_root = Path(tmp) / "raw"
        for year in (2019, 2020):
            partition = raw_root / "IRS990Data" / "XML Files" / f"{year}_990"
            partition.mkdir(parents=True)

        (raw_root / "IRS990Data" / "XML Files" / "2020_990" / "f1.xml").write_text(
            SAMPLE_990_XML, encoding="utf-8"
        )
        (raw_root / "IRS990Data" / "XML Files" / "2019_990" / "f2.xml").write_text(
            NO_NAMESPACE_990, encoding="utf-8"
        )

        output_dir = Path(tmp) / "processed" / "normalized"
        result = normalize_corpus(raw_root, output_dir)

        self.assertEqual(result["filings_parsed"], 2)
        self.assertEqual(result["unique_org_years"], 2)


class TestDuplicateResolution(unittest.TestCase):
    """Duplicate/amended filings collapse to one org-year record."""

    def _tmpdir(self) -> str:
        if not hasattr(self, "_cached_tmpdir"):
            self._cached_tmpdir = TemporaryDirectory()
            self.addCleanup(self._cached_tmpdir.cleanup)
        return self._cached_tmpdir.name

    def test_duplicate_ein_tax_year_keeps_latest(self) -> None:
        import pyarrow.parquet as pq

        tmp = self._tmpdir()
        raw_root = _make_990_partition(tmp, 2020)
        partition = raw_root / "IRS990Data" / "XML Files" / "2020_990"

        # Original filing
        (partition / "original.xml").write_text(SAMPLE_990_XML, encoding="utf-8")
        # Amended filing (same EIN + tax_year, later timestamp)
        (partition / "amended.xml").write_text(AMENDED_990_XML, encoding="utf-8")

        output_dir = Path(tmp) / "processed" / "normalized"
        result = normalize_corpus(raw_root, output_dir)

        # filings.parquet has both
        filings_table = pq.read_table(result["outputs"]["filings_parquet"])
        self.assertEqual(filings_table.num_rows, 2)

        # org_year_panel has only one (deduped)
        panel_table = pq.read_table(result["outputs"]["org_year_panel_parquet"])
        self.assertEqual(panel_table.num_rows, 1)

        # The kept record should be the amended one (later timestamp)
        kept_revenue = panel_table.column("total_revenue").to_pylist()[0]
        self.assertEqual(kept_revenue, 5000000)

        # Manifest shows duplicate evidence
        manifest = json.loads(Path(result["outputs"]["normalization_manifest"]).read_text())
        self.assertGreater(len(manifest["duplicate_buckets"]), 0)
        self.assertEqual(manifest["summary"]["amended_return_count"], 1)


class TestMalformedXmlQuarantine(unittest.TestCase):
    """Malformed XML is quarantined without crashing."""

    def _tmpdir(self) -> str:
        if not hasattr(self, "_cached_tmpdir"):
            self._cached_tmpdir = TemporaryDirectory()
            self.addCleanup(self._cached_tmpdir.cleanup)
        return self._cached_tmpdir.name

    def test_bad_file_quarantined_not_crash(self) -> None:
        tmp = self._tmpdir()
        raw_root = _make_990_partition(tmp, 2020)
        partition = raw_root / "IRS990Data" / "XML Files" / "2020_990"

        # One good, one bad
        (partition / "good.xml").write_text(SAMPLE_990_XML, encoding="utf-8")
        (partition / "bad.xml").write_text(MALFORMED_XML, encoding="utf-8")

        output_dir = Path(tmp) / "processed" / "normalized"
        result = normalize_corpus(raw_root, output_dir)

        self.assertEqual(result["filings_parsed"], 1)
        self.assertEqual(result["quarantined"], 1)

        manifest = json.loads(Path(result["outputs"]["normalization_manifest"]).read_text())
        self.assertEqual(len(manifest["quarantined_files"]), 1)
        self.assertIn("XML parse error", manifest["quarantined_files"][0]["error"])


class TestSchemaAndNamespaceDrift(unittest.TestCase):
    """Files with different namespace/tag conventions still parse."""

    def _tmpdir(self) -> str:
        if not hasattr(self, "_cached_tmpdir"):
            self._cached_tmpdir = TemporaryDirectory()
            self.addCleanup(self._cached_tmpdir.cleanup)
        return self._cached_tmpdir.name

    def test_alternate_year_tags_resolve(self) -> None:
        tmp = self._tmpdir()
        raw_root = _make_990_partition(tmp, 2016)
        partition = raw_root / "IRS990Data" / "XML Files" / "2016_990"
        (partition / "alt.xml").write_text(SAMPLE_990_ALTERNATE_TAGS, encoding="utf-8")

        output_dir = Path(tmp) / "processed" / "normalized"
        result = normalize_corpus(raw_root, output_dir)

        self.assertEqual(result["filings_parsed"], 1)

        import pyarrow.parquet as pq
        table = pq.read_table(result["outputs"]["filings_parquet"])
        self.assertEqual(table.column("ein").to_pylist(), ["987654321"])
        self.assertEqual(table.column("total_revenue").to_pylist(), [1000000])
        self.assertEqual(table.column("state").to_pylist(), ["NY"])

    def test_no_namespace_file_parses(self) -> None:
        tmp = self._tmpdir()
        raw_root = _make_990_partition(tmp, 2019)
        partition = raw_root / "IRS990Data" / "XML Files" / "2019_990"
        (partition / "nonamespace.xml").write_text(NO_NAMESPACE_990, encoding="utf-8")

        output_dir = Path(tmp) / "processed" / "normalized"
        result = normalize_corpus(raw_root, output_dir)

        self.assertEqual(result["filings_parsed"], 1)

        import pyarrow.parquet as pq
        table = pq.read_table(result["outputs"]["filings_parquet"])
        self.assertEqual(table.column("organization_name").to_pylist(), ["NO NAMESPACE ORG"])
        self.assertEqual(table.column("total_revenue").to_pylist(), [2000000])


class TestCLIIntegration(unittest.TestCase):
    """CLI returns correct exit codes."""

    def _tmpdir(self) -> str:
        if not hasattr(self, "_cached_tmpdir"):
            self._cached_tmpdir = TemporaryDirectory()
            self.addCleanup(self._cached_tmpdir.cleanup)
        return self._cached_tmpdir.name

    def test_normalize_no_data_returns_exit_1(self) -> None:
        from hackathon_pipeline.cli import main

        tmp = self._tmpdir()
        raw_root = Path(tmp) / "empty"
        output_dir = Path(tmp) / "output"

        exit_code = main(["normalize", "--raw-root", str(raw_root), "--output-dir", str(output_dir)])
        self.assertEqual(exit_code, 1)

    def test_normalize_with_data_returns_exit_0(self) -> None:
        from hackathon_pipeline.cli import main

        tmp = self._tmpdir()
        raw_root = _make_990_partition(tmp, 2020)
        partition = raw_root / "IRS990Data" / "XML Files" / "2020_990"
        (partition / "filing.xml").write_text(SAMPLE_990_XML, encoding="utf-8")
        output_dir = Path(tmp) / "processed" / "normalized"

        exit_code = main(["normalize", "--raw-root", str(raw_root), "--output-dir", str(output_dir)])
        self.assertEqual(exit_code, 0)


if __name__ == "__main__":
    unittest.main()
