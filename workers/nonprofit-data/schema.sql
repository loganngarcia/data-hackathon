-- Tipping Point: nonprofit 990 data cache
-- Source: ProPublica Nonprofit Explorer API v2
-- Run once against the D1 database with: wrangler d1 execute nonprofit-990 --file=schema.sql

-- ─── Organizations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  ein          TEXT    PRIMARY KEY,   -- 9-digit EIN, no dashes (e.g. "330103012")
  name         TEXT    NOT NULL,
  city         TEXT    NOT NULL DEFAULT '',
  state        TEXT    NOT NULL DEFAULT '',
  ntee_code    TEXT    NOT NULL DEFAULT '',
  ntee_label   TEXT    NOT NULL DEFAULT 'Nonprofit',
  last_synced  INTEGER NOT NULL DEFAULT (unixepoch())  -- unix epoch seconds
);

-- ─── Annual filings (one row per org per tax year) ────────────────────────────
CREATE TABLE IF NOT EXISTS filings (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  ein                  TEXT    NOT NULL REFERENCES organizations(ein) ON DELETE CASCADE,
  tax_year             INTEGER NOT NULL,

  -- P&L
  total_revenue        REAL    NOT NULL DEFAULT 0,
  total_expenses       REAL    NOT NULL DEFAULT 0,
  rev_less_expenses    REAL    NOT NULL DEFAULT 0,

  -- Revenue breakdown
  contributions_grants  REAL   NOT NULL DEFAULT 0,
  program_service_rev   REAL   NOT NULL DEFAULT 0,
  investment_income     REAL   NOT NULL DEFAULT 0,
  other_revenue         REAL   NOT NULL DEFAULT 0,

  -- Balance sheet
  net_assets_eoy       REAL    NOT NULL DEFAULT 0,

  -- Expenses
  program_expenses     REAL    NOT NULL DEFAULT 0,
  total_func_expenses  REAL    NOT NULL DEFAULT 0,

  UNIQUE(ein, tax_year)
);

CREATE INDEX IF NOT EXISTS idx_filings_ein      ON filings(ein);
CREATE INDEX IF NOT EXISTS idx_filings_tax_year ON filings(tax_year);

-- ─── Computed scores cache (derived, refreshed on sync) ───────────────────────
CREATE TABLE IF NOT EXISTS scores (
  ein              TEXT    PRIMARY KEY REFERENCES organizations(ein) ON DELETE CASCADE,
  composite_score  REAL    NOT NULL DEFAULT 0,   -- 0–100
  tier             TEXT    NOT NULL DEFAULT 'Urgent',
  risk_band        TEXT    NOT NULL DEFAULT 'At Risk',
  reserve_months   REAL    NOT NULL DEFAULT 0,
  growth_rate      REAL    NOT NULL DEFAULT 0,
  staff_estimate   INTEGER NOT NULL DEFAULT 1,
  current_revenue  REAL    NOT NULL DEFAULT 0,
  prior_revenue    REAL    NOT NULL DEFAULT 0,
  computed_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
