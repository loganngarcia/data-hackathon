-- Cached Logo.dev resolution: website hostname from TEOS and/or Brand Search (see POST /api/logo-cache-warm).
-- Apply: wrangler d1 execute nonprofit-990 --remote --file=schema-org-logo-cache.sql

CREATE TABLE IF NOT EXISTS org_logo_cache (
  ein          TEXT    PRIMARY KEY,
  logo_domain  TEXT    NOT NULL,
  source       TEXT    NOT NULL DEFAULT 'brand_search',
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_org_logo_cache_updated ON org_logo_cache(updated_at);
