-- IRS Form 990 TEOS index (CSV) → one row per (EIN, tax year) filing stub.
-- Populate with: node scripts/fetch-irs-index.mjs  (generates SQL batches) then wrangler d1 execute …
-- Source: https://www.irs.gov/charities-non-profits/form-990-series-downloads
-- Index URL pattern: https://apps.irs.gov/pub/epostcard/990/xml/{YEAR}/index_{YEAR}.csv

CREATE TABLE IF NOT EXISTS irs_ein_years (
  ein TEXT NOT NULL,
  year INTEGER NOT NULL,
  PRIMARY KEY (ein, year)
);

CREATE INDEX IF NOT EXISTS idx_irs_ein_years_year ON irs_ein_years(year);
CREATE INDEX IF NOT EXISTS idx_irs_ein_years_ein ON irs_ein_years(ein);
