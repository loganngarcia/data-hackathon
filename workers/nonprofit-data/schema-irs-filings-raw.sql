-- Full IRS TEOS index: one row per filing in each year’s index_{YEAR}.csv
-- PK is OBJECT_ID (always present). RETURN_ID may be blank in newer index files.
-- Import: npm run irs:index (generates SQL batches)

CREATE TABLE IF NOT EXISTS irs_filings_raw (
  object_id      TEXT    PRIMARY KEY,
  return_id      TEXT,
  filing_type    TEXT,
  ein            TEXT    NOT NULL,
  tax_period     TEXT,
  sub_date       TEXT,
  taxpayer_name  TEXT,
  return_type    TEXT,
  dln            TEXT,
  xml_batch_id   TEXT,
  index_year     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_irs_filings_raw_ein ON irs_filings_raw(ein);
CREATE INDEX IF NOT EXISTS idx_irs_filings_raw_index_year ON irs_filings_raw(index_year);
