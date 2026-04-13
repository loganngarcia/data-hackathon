-- Apply once if `irs990_xml_returns` already existed without v2 columns (older hackathon DBs).
-- Safe to run multiple times only if your SQLite ignores duplicate column errors; otherwise run each ALTER separately.

ALTER TABLE irs990_xml_returns ADD COLUMN return_version TEXT;
ALTER TABLE irs990_xml_returns ADD COLUMN organization_501c_type_txt TEXT;
ALTER TABLE irs990_xml_returns ADD COLUMN py_benefits_paid_to_members_amt REAL;
ALTER TABLE irs990_xml_returns ADD COLUMN cy_benefits_paid_to_members_amt REAL;
ALTER TABLE irs990_xml_returns ADD COLUMN membership_dues_amt REAL;
