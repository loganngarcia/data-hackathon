# IRS bulk “all filings” dataset in D1 (hackathon-scale)

Judges pointed you at [Form 990 series downloads](https://www.irs.gov/charities-non-profits/form-990-series-downloads). There are two different things:

| Artifact | Size | What it is |
|----------|------|------------|
| **ZIP / XML** | Very large | Raw 990 XML — use when you need fields we don’t parse |
| **Index CSV** (per year) | Tens of MB | **Complete list of filings** in that bulk release — **EIN, name, return id, which ZIP part, etc.** |

**To have “everything” in your database for the hackathon, you do not upload ZIPs to anyone.**  
Import the **index CSVs** into D1 table **`irs_filings_raw`** — that **is** the full TEOS index mirror (every row × every year you import).

ProPublica **cannot** replace that at full scale (no bulk EIN list API, rate limits, incomplete coverage). It remains the best way to **enrich** rows with parsed 990 financials + Moobu-style scores for **subsets** of EINs.

---

## 1. Migrate D1 schema

From `workers/nonprofit-data/`:

```bash
npm run db:migrate:irs:remote           # irs_ein_years (ein + index year)
npm run db:migrate:filings-raw:remote   # irs_filings_raw (full index rows)
```

(`schema.sql` for organizations / filings / scores should already be applied.)

---

## 2. Generate SQL from IRS index CSVs (2019–2026)

This **streams** from IRS — no manual ZIP download required:

```bash
npm install
npm run irs:index -- --out ./irs-index-out
```

- Writes `batch-*.sql` with `INSERT OR IGNORE` into **`irs_filings_raw`**.
- Writes **`zzz-fill-irs-ein-years.sql`** — run **after** all batches to fill **`irs_ein_years`** (`DISTINCT ein, index_year`).

Full eight years will take a while and produce **many** batch files (expect **millions** of rows total — plan disk space and time).

---

## 3. Apply batches to remote D1

```bash
for f in ./irs-index-out/batch-*.sql; do
  wrangler d1 execute nonprofit-990 --remote --file="$f"
done
wrangler d1 execute nonprofit-990 --remote --file=./irs-index-out/zzz-fill-irs-ein-years.sql
```

---

## 4. Inspect counts & browse rows

```bash
curl -s "https://<your-worker>/api/stats"
```

Paginated index (keyset on `return_id`):

```bash
curl -s "https://<your-worker>/api/registry?limit=50"
curl -s "https://<your-worker>/api/registry?limit=50&after=<nextAfter_from_previous_response>"
```

---

## 5. Optional: ProPublica enrichment (not “all” in one shot)

```bash
curl -X POST "https://<your-worker>/api/sync/registry-batch?limit=25" \
  -H "X-Admin-Key: $ADMIN_KEY"
```

Repeat over time. Many IRS EINs will **404** on ProPublica — that’s expected.

---

## 6. Optional: full 990 XML into D1 (website, officers, preparer, …)

If you unzip TEOS XML and need **rich fields** (not just the index CSV), apply **`schema-irs990-xml.sql`** and run **`scripts/parse-irs990-xml.mjs`**. See **[IRS-990-XML-INGEST.md](./IRS-990-XML-INGEST.md)** for tables `irs990_xml_returns` / `irs990_xml_people` and join keys.

---

## Summary

- **“All in DB” for the IRS release** → **`irs_filings_raw`** + **`irs_ein_years`** via index CSV import.  
- **ZIPs** → only if you need raw XML beyond the index / beyond ProPublica.  
- **Dashboard still uses `PORTFOLIO_EINS`** for the curated Tipping Point view unless you change the app to read from `/api/registry` or a new query.
