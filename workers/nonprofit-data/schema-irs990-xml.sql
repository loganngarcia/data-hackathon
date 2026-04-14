-- Rich extract from IRS e-file Form 990 XML (TEOS / ZIP public XML).
-- Populated by: node scripts/parse-irs990-xml.mjs --file … | wrangler d1 execute …
-- Complements ProPublica-derived `organizations` / `filings` — this is the authoritative raw 990 snapshot.

CREATE TABLE IF NOT EXISTS irs990_xml_returns (
  return_pk                   TEXT PRIMARY KEY,  -- OBJECT_ID from filename or derived id
  ein                         TEXT    NOT NULL,
  tax_yr                      INTEGER,
  return_ts                   TEXT,
  return_type_cd              TEXT,
  return_version              TEXT,   -- e.g. 2017v2.2, 2024v5.5 from <Return returnVersion="…">
  tax_period_begin_dt         TEXT,
  tax_period_end_dt           TEXT,
  org_legal_name              TEXT,
  org_phone                   TEXT,
  filer_address_line1         TEXT,
  filer_city                  TEXT,
  filer_state                 TEXT,
  filer_zip                   TEXT,
  business_officer_person_nm  TEXT,
  business_officer_title_txt  TEXT,
  business_officer_phone      TEXT,
  signature_dt                TEXT,
  principal_officer_nm        TEXT,
  principal_address_line1     TEXT,
  principal_city              TEXT,
  principal_state             TEXT,
  principal_zip               TEXT,
  website_txt                 TEXT,
  activity_mission_desc       TEXT,
  mission_desc                TEXT,
  formation_yr                INTEGER,
  legal_domicile_state_cd     TEXT,
  organization_501c3_ind      INTEGER NOT NULL DEFAULT 0,  -- 1 if 501(c)(3); see organization_501c_type_txt
  organization_501c_type_txt  TEXT,   -- IRS subsection: 3, 4, 5, 6… from Organization501cInd @organization501cTypeTxt or inferred "3"
  gross_receipts_amt        REAL,
  cy_total_revenue_amt        REAL,
  cy_total_expenses_amt       REAL,
  py_total_revenue_amt        REAL,
  py_total_expenses_amt       REAL,
  cy_rev_less_expenses_amt    REAL,
  total_assets_boy_amt        REAL,
  total_assets_eoy_amt        REAL,
  total_liabilities_boy_amt   REAL,
  total_liabilities_eoy_amt   REAL,
  net_assets_boy_amt          REAL,
  net_assets_eoy_amt          REAL,
  total_employee_cnt          INTEGER,
  total_volunteers_cnt        INTEGER,
  voting_members_governing_cnt INTEGER,
  voting_members_independent_cnt INTEGER,
  total_program_service_expenses_amt REAL,
  cy_total_management_and_general_expenses_amt REAL,
  cy_total_fundraising_expense_amt REAL,
  cy_contributions_grants_amt REAL,
  cy_program_service_revenue_amt REAL,
  cy_investment_income_amt    REAL,
  cy_other_revenue_amt        REAL,
  py_benefits_paid_to_members_amt REAL,
  cy_benefits_paid_to_members_amt REAL,
  membership_dues_amt         REAL,   -- Part VIII; common for 501(c)(5)/(6) membership orgs
  preparer_firm_ein           TEXT,
  preparer_firm_name          TEXT,
  preparer_address_line1      TEXT,
  preparer_city               TEXT,
  preparer_state              TEXT,
  preparer_zip                TEXT,
  preparer_person_nm          TEXT,
  preparer_ptin               TEXT,
  preparer_phone              TEXT,
  books_in_care_of_name       TEXT,
  books_phone                 TEXT,
  books_address_line1         TEXT,
  books_city                  TEXT,
  books_state                 TEXT,
  books_zip                   TEXT,
  governing_body_voting_cnt   INTEGER,
  independent_voting_member_cnt INTEGER,
  source_filename             TEXT,
  imported_at                 INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_irs990_xml_returns_ein ON irs990_xml_returns(ein);
CREATE INDEX IF NOT EXISTS idx_irs990_xml_returns_tax_yr ON irs990_xml_returns(tax_yr);

-- Part VII Section A — officers, directors, trustees, key employees (names, titles, comp, hours)
CREATE TABLE IF NOT EXISTS irs990_xml_people (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  return_pk                   TEXT    NOT NULL REFERENCES irs990_xml_returns(return_pk) ON DELETE CASCADE,
  row_ix                      INTEGER NOT NULL,
  person_nm                   TEXT,
  title_txt                   TEXT,
  average_hours_per_week      REAL,
  reportable_comp_from_org_amt REAL,
  reportable_comp_rltd_org_amt REAL,
  other_compensation_amt      REAL,
  individual_trustee_or_director_ind INTEGER NOT NULL DEFAULT 0,
  officer_ind                 INTEGER NOT NULL DEFAULT 0,
  key_employee_ind            INTEGER NOT NULL DEFAULT 0,
  highest_compensated_ind     INTEGER NOT NULL DEFAULT 0,
  former_ind                  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_irs990_xml_people_return ON irs990_xml_people(return_pk);
CREATE INDEX IF NOT EXISTS idx_irs990_xml_people_ein_name ON irs990_xml_people(person_nm);
