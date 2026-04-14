#!/usr/bin/env node
/**
 * Parse IRS e-file Form 990 XML (public TEOS extract) → SQL INSERTs for D1.
 *
 * Usage:
 *   npm run irs:parse-xml -- --file path/to/202640229349300709_public.xml
 *   npm run irs:parse-xml -- --dir ./unzipped-xml-folder
 *   npm run irs:parse-xml -- --file x.xml --dry-run   # print stats only
 *
 * D1: do not wrap in BEGIN/COMMIT (Cloudflare D1 rejects explicit SQL transactions).
 *
 * return_pk defaults to OBJECT_ID from filename: *_{OBJECT_ID}_public.xml → OBJECT_ID
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
  isArray: (tagName) =>
    tagName === "Form990PartVIISectionAGrp" ||
    tagName === "SupplementalInformationDetail",
});

function sqlStr(v) {
  if (v == null || v === undefined) return "NULL";
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

function sqlInt(v) {
  if (v == null || v === undefined || v === "") return "NULL";
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? String(n) : "NULL";
}

function sqlReal(v) {
  if (v == null || v === undefined || v === "") return "NULL";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "NULL";
}

/** IRS indicators: <Tag>X</Tag>, boolean true/false (older schemas), or #text nodes with attributes. */
function truthyInd(v) {
  if (v == null) return 0;
  if (v === true || v === 1) return 1;
  if (v === false || v === 0) return 0;
  if (typeof v === "object" && "#text" in v) {
    return truthyInd(v["#text"]);
  }
  const s = String(v).trim().toUpperCase();
  if (s === "X" || s === "TRUE" || s === "1" || s === "Y") return 1;
  return 0;
}

function elementText(el) {
  if (el == null) return null;
  const t = typeof el;
  if (t === "string" || t === "number" || t === "boolean") return String(el);
  if (t === "object" && "#text" in el) return String(el["#text"]);
  return null;
}

/**
 * 501(c)(3) checkbox vs Organization501cInd @organization501cTypeTxt (3,4,5,6,…).
 * Older filings use Organization501cInd only; 501(c)(3) filings often use Organization501c3Ind>X</Organization501c3Ind>.
 */
function extract501cMeta(irs990) {
  const gen = irs990.Organization501cInd;
  let typeTxt = null;
  if (gen != null && typeof gen === "object" && !Array.isArray(gen)) {
    typeTxt = gen["@_organization501cTypeTxt"] ?? gen["@_organization501ctypetxt"] ?? null;
  }
  const c3El = irs990.Organization501c3Ind;
  const c3Str = typeof c3El === "string" ? c3El : c3El?.["#text"];
  const c3Marked = c3Str != null && String(c3Str).trim().toUpperCase() === "X";
  if (!typeTxt && c3Marked) typeTxt = "3";
  const organization_501c3_ind = typeTxt === "3" || (typeTxt == null && c3Marked) ? 1 : 0;
  return { organization_501c_type_txt: typeTxt, organization_501c3_ind };
}

/** Net assets: primary BOY/EOY; fallback when filer uses alternate net-asset groups (non–SFAS-117 presentations). */
function pickNetAssets(irs990) {
  let boy = irs990.NetAssetsOrFundBalancesBOYAmt;
  let eoy = irs990.NetAssetsOrFundBalancesEOYAmt;
  if (boy == null && eoy == null) {
    const g = irs990.TotalNetAssetsFundBalanceGrp;
    if (g && typeof g === "object") {
      boy = g.BOYAmt ?? boy;
      eoy = g.EOYAmt ?? eoy;
    }
  }
  if (boy == null && eoy == null) {
    const r = irs990.RtnEarnEndowmentIncmOthFndsGrp;
    if (r && typeof r === "object") {
      boy = r.BOYAmt ?? boy;
      eoy = r.EOYAmt ?? eoy;
    }
  }
  return { boy, eoy };
}

/** Books: BusinessName (common) or PersonNm (many older / smaller returns). */
function booksCareOfName(books) {
  if (!books || typeof books !== "object") return null;
  return (
    businessNameLine(books.BusinessName) ??
    (books.PersonNm != null ? String(books.PersonNm) : null) ??
    elementText(books.BusinessName)
  );
}

function asArray(x) {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function usAddress(addr) {
  if (!addr || typeof addr !== "object") {
    return { line1: null, city: null, state: null, zip: null };
  }
  return {
    line1: addr.AddressLine1Txt ?? null,
    city: addr.CityNm ?? null,
    state: addr.StateAbbreviationCd ?? null,
    zip: addr.ZIPCd ?? null,
  };
}

function businessNameLine(bn) {
  if (!bn || typeof bn !== "object") return null;
  return bn.BusinessNameLine1Txt ?? bn.businessNameLine1Txt ?? null;
}

/** TEOS bulk zips include 990-PF, 990-EZ, etc. This ingest targets full Form 990 only (`ReturnTypeCd` = 990). */
function isFullForm990Xml(xmlText) {
  return /<ReturnTypeCd>\s*990\s*<\/ReturnTypeCd>/.test(xmlText);
}

/**
 * Derive return_pk from filename: …/202640229349300709_public.xml → 202640229349300709
 */
function returnPkFromFilename(name) {
  const base = basename(name, ".xml");
  const m = base.match(/^(\d+)_public$/i);
  if (m) return m[1];
  const stripped = base.replace(/_public$/i, "");
  if (/^\d+$/.test(stripped)) return stripped;
  return base;
}

function extractReturnRow(xmlText, sourceFilename, returnPkOverride) {
  const parsed = parser.parse(xmlText);
  const ret = parsed.Return ?? parsed.return;
  if (!ret) throw new Error("Root <Return> not found");

  const header = ret.ReturnHeader;
  const data = ret.ReturnData;
  const irs990 = data?.IRS990;
  if (!irs990) {
    const rt = header?.ReturnTypeCd ?? "?";
    throw new Error(`ReturnData.IRS990 not found (ReturnTypeCd=${rt}; expected full Form 990)`);
  }

  const returnPk = returnPkOverride ?? returnPkFromFilename(sourceFilename);
  const returnVersion = ret["@_returnVersion"] ?? ret["@_returnversion"] ?? null;
  const filer = header?.Filer ?? {};
  const filerAddr = usAddress(filer.USAddress);
  const bizOff = header?.BusinessOfficerGrp ?? {};
  const prepFirm = header?.PreparerFirmGrp ?? {};
  const prepFirmAddr = usAddress(prepFirm.PreparerUSAddress);
  const prepPerson = header?.PreparerPersonGrp ?? {};

  const principalAddr = usAddress(irs990.USAddress);
  const books = irs990.BooksInCareOfDetail ?? {};
  const booksAddr = usAddress(books.USAddress);
  const booksName = booksCareOfName(books);
  const { organization_501c_type_txt, organization_501c3_ind } = extract501cMeta(irs990);
  const { boy: net_assets_boy_amt, eoy: net_assets_eoy_amt } = pickNetAssets(irs990);

  const people = asArray(irs990.Form990PartVIISectionAGrp);

  const row = {
    return_pk: returnPk,
    ein: filer.EIN != null ? String(filer.EIN) : null,
    tax_yr: header?.TaxYr != null ? parseInt(String(header.TaxYr), 10) : null,
    return_ts: header?.ReturnTs ?? null,
    return_type_cd: header?.ReturnTypeCd ?? null,
    return_version: returnVersion != null ? String(returnVersion) : null,
    tax_period_begin_dt: header?.TaxPeriodBeginDt ?? null,
    tax_period_end_dt: header?.TaxPeriodEndDt ?? null,
    org_legal_name: businessNameLine(filer.BusinessName),
    org_phone: filer.PhoneNum ?? null,
    filer_address_line1: filerAddr.line1,
    filer_city: filerAddr.city,
    filer_state: filerAddr.state,
    filer_zip: filerAddr.zip,
    business_officer_person_nm: bizOff.PersonNm ?? null,
    business_officer_title_txt: bizOff.PersonTitleTxt ?? null,
    business_officer_phone: bizOff.PhoneNum ?? null,
    signature_dt: bizOff.SignatureDt ?? null,
    principal_officer_nm: irs990.PrincipalOfficerNm ?? null,
    principal_address_line1: principalAddr.line1,
    principal_city: principalAddr.city,
    principal_state: principalAddr.state,
    principal_zip: principalAddr.zip,
    website_txt: irs990.WebsiteAddressTxt ?? null,
    activity_mission_desc: irs990.ActivityOrMissionDesc ?? null,
    mission_desc: irs990.MissionDesc ?? null,
    formation_yr: irs990.FormationYr != null ? parseInt(String(irs990.FormationYr), 10) : null,
    legal_domicile_state_cd: irs990.LegalDomicileStateCd ?? null,
    organization_501c3_ind,
    organization_501c_type_txt,
    gross_receipts_amt: irs990.GrossReceiptsAmt,
    cy_total_revenue_amt: irs990.CYTotalRevenueAmt,
    cy_total_expenses_amt: irs990.CYTotalExpensesAmt,
    py_total_revenue_amt: irs990.PYTotalRevenueAmt,
    py_total_expenses_amt: irs990.PYTotalExpensesAmt,
    cy_rev_less_expenses_amt: irs990.CYRevenuesLessExpensesAmt,
    total_assets_boy_amt: irs990.TotalAssetsBOYAmt,
    total_assets_eoy_amt: irs990.TotalAssetsEOYAmt,
    total_liabilities_boy_amt: irs990.TotalLiabilitiesBOYAmt,
    total_liabilities_eoy_amt: irs990.TotalLiabilitiesEOYAmt,
    net_assets_boy_amt,
    net_assets_eoy_amt,
    total_employee_cnt: irs990.TotalEmployeeCnt ?? irs990.EmployeeCnt,
    total_volunteers_cnt: irs990.TotalVolunteersCnt,
    voting_members_governing_cnt: irs990.VotingMembersGoverningBodyCnt,
    voting_members_independent_cnt: irs990.VotingMembersIndependentCnt,
    total_program_service_expenses_amt: irs990.TotalProgramServiceExpensesAmt,
    cy_total_management_and_general_expenses_amt:
      irs990.CYTotalManagementAndGeneralExpensesAmt ??
      irs990.CYTotalManagementAndGeneralExpenseAmt ??
      irs990.TotalManagementAndGeneralExpensesAmt,
    cy_total_fundraising_expense_amt: irs990.CYTotalFundraisingExpenseAmt,
    cy_contributions_grants_amt: irs990.CYContributionsGrantsAmt,
    cy_program_service_revenue_amt: irs990.CYProgramServiceRevenueAmt,
    cy_investment_income_amt: irs990.CYInvestmentIncomeAmt,
    cy_other_revenue_amt: irs990.CYOtherRevenueAmt,
    py_benefits_paid_to_members_amt: irs990.PYBenefitsPaidToMembersAmt,
    cy_benefits_paid_to_members_amt: irs990.CYBenefitsPaidToMembersAmt,
    membership_dues_amt: irs990.MembershipDuesAmt,
    preparer_firm_ein: prepFirm.PreparerFirmEIN ?? null,
    preparer_firm_name: businessNameLine(prepFirm.PreparerFirmName),
    preparer_address_line1: prepFirmAddr.line1,
    preparer_city: prepFirmAddr.city,
    preparer_state: prepFirmAddr.state,
    preparer_zip: prepFirmAddr.zip,
    preparer_person_nm: prepPerson.PreparerPersonNm ?? null,
    preparer_ptin: prepPerson.PTIN ?? null,
    preparer_phone: prepPerson.PhoneNum ?? null,
    books_in_care_of_name: booksName,
    books_phone: books.PhoneNum ?? null,
    books_address_line1: booksAddr.line1,
    books_city: booksAddr.city,
    books_state: booksAddr.state,
    books_zip: booksAddr.zip,
    governing_body_voting_cnt: irs990.GoverningBodyVotingMembersCnt,
    independent_voting_member_cnt: irs990.IndependentVotingMemberCnt,
    source_filename: basename(sourceFilename),
  };

  return { row, people, returnPk };
}

function buildInsertSql({ row, people, returnPk }) {
  const cols = [
    "return_pk",
    "ein",
    "tax_yr",
    "return_ts",
    "return_type_cd",
    "return_version",
    "tax_period_begin_dt",
    "tax_period_end_dt",
    "org_legal_name",
    "org_phone",
    "filer_address_line1",
    "filer_city",
    "filer_state",
    "filer_zip",
    "business_officer_person_nm",
    "business_officer_title_txt",
    "business_officer_phone",
    "signature_dt",
    "principal_officer_nm",
    "principal_address_line1",
    "principal_city",
    "principal_state",
    "principal_zip",
    "website_txt",
    "activity_mission_desc",
    "mission_desc",
    "formation_yr",
    "legal_domicile_state_cd",
    "organization_501c3_ind",
    "organization_501c_type_txt",
    "gross_receipts_amt",
    "cy_total_revenue_amt",
    "cy_total_expenses_amt",
    "py_total_revenue_amt",
    "py_total_expenses_amt",
    "cy_rev_less_expenses_amt",
    "total_assets_boy_amt",
    "total_assets_eoy_amt",
    "total_liabilities_boy_amt",
    "total_liabilities_eoy_amt",
    "net_assets_boy_amt",
    "net_assets_eoy_amt",
    "total_employee_cnt",
    "total_volunteers_cnt",
    "voting_members_governing_cnt",
    "voting_members_independent_cnt",
    "total_program_service_expenses_amt",
    "cy_total_management_and_general_expenses_amt",
    "cy_total_fundraising_expense_amt",
    "cy_contributions_grants_amt",
    "cy_program_service_revenue_amt",
    "cy_investment_income_amt",
    "cy_other_revenue_amt",
    "py_benefits_paid_to_members_amt",
    "cy_benefits_paid_to_members_amt",
    "membership_dues_amt",
    "preparer_firm_ein",
    "preparer_firm_name",
    "preparer_address_line1",
    "preparer_city",
    "preparer_state",
    "preparer_zip",
    "preparer_person_nm",
    "preparer_ptin",
    "preparer_phone",
    "books_in_care_of_name",
    "books_phone",
    "books_address_line1",
    "books_city",
    "books_state",
    "books_zip",
    "governing_body_voting_cnt",
    "independent_voting_member_cnt",
    "source_filename",
  ];

  const vals = cols.map((c) => {
    const v = row[c];
    if (c === "organization_501c3_ind") return sqlInt(v);
    if (c === "organization_501c_type_txt") return sqlStr(v);
    if (
      c.endsWith("_cnt") ||
      c === "tax_yr" ||
      c === "formation_yr" ||
      c === "total_employee_cnt" ||
      c === "total_volunteers_cnt" ||
      c === "voting_members_governing_cnt" ||
      c === "voting_members_independent_cnt" ||
      c === "governing_body_voting_cnt" ||
      c === "independent_voting_member_cnt"
    ) {
      return sqlInt(v);
    }
    if (
      c.includes("_amt") ||
      c.includes("gross_receipts") ||
      c === "cy_rev_less_expenses_amt" ||
      c === "py_benefits_paid_to_members_amt" ||
      c === "cy_benefits_paid_to_members_amt" ||
      c === "membership_dues_amt"
    ) {
      return sqlReal(v);
    }
    return sqlStr(v);
  });

  let sql = "";
  sql += `DELETE FROM irs990_xml_people WHERE return_pk = ${sqlStr(returnPk)};\n`;
  sql += `DELETE FROM irs990_xml_returns WHERE return_pk = ${sqlStr(returnPk)};\n`;
  sql += `INSERT INTO irs990_xml_returns (${cols.join(", ")}) VALUES (${vals.join(", ")});\n`;

  people.forEach((p, ix) => {
    const trustee = truthyInd(p.IndividualTrusteeOrDirectorInd);
    const officer = truthyInd(p.OfficerInd);
    const keyEmp = truthyInd(p.KeyEmployeeInd);
    const hiComp = truthyInd(p.HighestCompensatedEmployeeInd);
    const former = truthyInd(p.FormerInd);
    sql +=
      `INSERT INTO irs990_xml_people (return_pk, row_ix, person_nm, title_txt, average_hours_per_week, ` +
      `reportable_comp_from_org_amt, reportable_comp_rltd_org_amt, other_compensation_amt, ` +
      `individual_trustee_or_director_ind, officer_ind, key_employee_ind, highest_compensated_ind, former_ind) VALUES (` +
      `${sqlStr(returnPk)}, ${ix}, ${sqlStr(p.PersonNm)}, ${sqlStr(p.TitleTxt)}, ${sqlReal(p.AverageHoursPerWeekRt)}, ` +
      `${sqlReal(p.ReportableCompFromOrgAmt)}, ${sqlReal(p.ReportableCompFromRltdOrgAmt)}, ${sqlReal(p.OtherCompensationAmt)}, ` +
      `${trustee}, ${officer}, ${keyEmp}, ${hiComp}, ${former}` +
      `);\n`;
  });

  return sql;
}

function parseArgs(argv) {
  const out = {
    file: null,
    dir: null,
    dryRun: false,
    help: false,
    skip: 0,
    limit: null,
    continueOnError: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" || a === "-f") out.file = argv[++i];
    else if (a === "--dir" || a === "-d") out.dir = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--skip") out.skip = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === "--limit") out.limit = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === "--continue-on-error") out.continueOnError = true;
  }
  return out;
}

function walkXmlFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkXmlFiles(p));
    else if (e.isFile() && e.name.toLowerCase().endsWith(".xml")) out.push(p);
  }
  return out;
}

function listXmlFiles(dir) {
  return walkXmlFiles(dir).sort();
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.error(`Usage: node scripts/parse-irs990-xml.mjs --file <path.xml>
       node scripts/parse-irs990-xml.mjs --dir <folder>
       --dir <folder> --skip N --limit M   (chunked ingest; sorted paths)
       --continue-on-error                 (skip bad XML; still emit SQL for OK files)
       --dry-run   validate only, no SQL output`);
    process.exit(0);
  }

  let files = [];
  if (args.file) files = [args.file];
  else if (args.dir) {
    files = listXmlFiles(args.dir);
    const skip = args.skip ?? 0;
    const lim = args.limit;
    if (lim != null && lim > 0) files = files.slice(skip, skip + lim);
    else files = files.slice(skip);
    if (args.dir && !args.file) {
      console.error(
        `Chunk: skip=${skip} limit=${lim ?? "all"} → ${files.length} file(s) (dir mode)`,
      );
    }
  } else {
    console.error("Provide --file <path.xml> or --dir <folder>");
    process.exit(1);
  }

  let allSql = "";
  let ok = 0;
  let skippedNon990 = 0;
  const errors = [];

  for (const fp of files) {
    try {
      const xmlText = readFileSync(fp, "utf8");
      if (args.dir && !isFullForm990Xml(xmlText)) {
        skippedNon990++;
        continue;
      }
      if (args.file && !isFullForm990Xml(xmlText)) {
        throw new Error(
          "Not a full Form 990 (need <ReturnTypeCd>990</ReturnTypeCd>; this file is 990EZ/990PF/etc.)",
        );
      }
      const extracted = extractReturnRow(xmlText, fp);
      if (args.dryRun) {
        console.error(`OK ${fp} → return_pk=${extracted.returnPk} people=${extracted.people.length}`);
        ok++;
        continue;
      }
      allSql += buildInsertSql(extracted);
      ok++;
    } catch (e) {
      errors.push({ fp, err: e });
    }
  }

  if (args.dryRun) {
    console.error(
      `Parsed ${ok} full Form 990 / ${files.length} file(s); skipped non-990: ${skippedNon990}`,
    );
    if (errors.length) {
      for (const { fp, err } of errors) console.error(`FAIL ${fp}: ${err.message}`);
      if (!args.continueOnError) process.exit(1);
    }
    process.exit(0);
  }

  if (skippedNon990 > 0) {
    console.error(`Skipped ${skippedNon990} non–Form-990 file(s) (990EZ/990PF/…) in this chunk.`);
  }

  if (errors.length) {
    for (const { fp, err } of errors) console.error(`FAIL ${fp}: ${err.message}`);
    if (!args.continueOnError) process.exit(1);
    if (ok === 0) process.exit(1);
  }

  if (ok === 0 && errors.length === 0) {
    console.error("No Form 990 XML to import in this chunk (all non-990 or empty list).");
    process.exit(0);
  }

  process.stdout.write(allSql);
}

main();
