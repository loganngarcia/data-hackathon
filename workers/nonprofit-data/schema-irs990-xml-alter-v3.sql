-- Add management & general functional expenses (Form 990 Part IX) for expense breakdown in the app.
-- Apply after schema-irs990-xml.sql. Re-ingest or backfill not required for NULL columns.

ALTER TABLE irs990_xml_returns ADD COLUMN cy_total_management_and_general_expenses_amt REAL;
