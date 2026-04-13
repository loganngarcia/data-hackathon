# Form 990 XML → D1 (rich TEOS extract)

Public IRS bulk XML (e.g. `*_public.xml` inside TEOS ZIPs) contains **far more** than the index CSV or ProPublica JSON: website, principal officer address, Part VII names/titles/compensation, preparer firm, books-in-care-of, long mission text, and detailed financial lines.

This repo stores that in **two D1 tables** (separate from ProPublica-derived `organizations` / `filings`):

| Table | Purpose |
|-------|---------|
| `irs990_xml_returns` | One row per parsed return: org identity, addresses, website, preparer, books contact, governance counts, major revenue/expense/asset figures, **return schema version**, **501(c) subsection** (`organization_501c_type_txt` e.g. `3` vs `5`), membership dues / benefits-to-members when present |
| `irs990_xml_people` | One row per **Part VII Section A** listing: name, title, hours, compensation flags (trustee / officer / key employee / etc.) |

**Primary key:** `return_pk` — defaults to the **OBJECT_ID** from the filename (`202640229349300709_public.xml` → `202640229349300709`). Align this with `irs_filings_raw.object_id` when joining index rows to XML.

---

## 1. Bulk TEOS ZIP (IRS epostcard) → chunked D1

Official release zips (example: [2026_TEOS_XML_01A.zip](https://apps.irs.gov/pub/epostcard/990/xml/2026/2026_TEOS_XML_01A.zip)) contain **tens of thousands** of XML files. The bulk mix includes **990-PF**, **990-EZ**, etc.; this pipeline stores **full Form 990 only** (`<ReturnTypeCd>990</ReturnTypeCd>`).

From `workers/nonprofit-data/`:

```bash
./scripts/ingest-teos-zip-to-d1.sh 'https://apps.irs.gov/pub/epostcard/990/xml/2026/2026_TEOS_XML_01A.zip' 150
```

- Caches zip + extract under **`.cache/teos/`** (gitignored).  
- **150** = XML paths per batch (sorted); only matching 990s produce SQL.  
- **No `BEGIN/COMMIT`** — Cloudflare D1 rejects explicit SQL transactions; statements run as a single execute batch.

**Resume** after a network error (third argument = XML **skip offset**, same as chunk size × failed batch index):

```bash
./scripts/ingest-teos-zip-to-d1.sh '…same URL…' 150 9900
```

Reuses cached extract; does not re-unzip from scratch.

---

## 2. Migrate schema

From `workers/nonprofit-data/`:

```bash
npm run db:migrate:irs990-xml:remote
```

(Local D1: drop `:remote`.)

If you already created `irs990_xml_returns` from an **older** `schema-irs990-xml.sql` (before v2 columns), apply additive columns once:

```bash
npm run db:migrate:irs990-xml-v2:alter:remote
```

(`schema-irs990-xml-alter-v2.sql` — SQLite will error if a column already exists; run statements one-by-one if needed.)

---

## 3. Parse XML files → SQL

Install deps once (`npm install`). Then:

```bash
# Single file
npm run irs:parse-xml -- --file /path/to/202640229349300709_public.xml > ingest-one.sql

# Whole folder of .xml
npm run irs:parse-xml -- --dir ./unzipped-xml > ingest-batch.sql

# Chunked (sorted paths): skip 3000, take next 200
npm run irs:parse-xml -- --dir ./unzipped-xml --skip 3000 --limit 200 > chunk.sql

# Validate without emitting SQL
npm run irs:parse-xml -- --file ./sample.xml --dry-run
```

Each run emits `DELETE` then `INSERT` for each `return_pk` (no SQL transaction wrapper — required for **D1**). Idempotent re-import.

---

## 4. Apply to D1

```bash
wrangler d1 execute nonprofit-990 --remote --file=ingest-one.sql
```

---

## 5. Privacy / public extracts

- **Schedule B** (large contributors) is often **redacted** in public XML (`RESTRICTED`). Do not assume contributor names/amounts are present.
- Part VII and header addresses are **published by the filer** on the 990; still handle responsibly in product UI.

---

## 6. Joining to the IRS index

After importing `irs_filings_raw`, match:

```sql
SELECT r.*, x.website_txt, x.principal_officer_nm
FROM irs_filings_raw r
LEFT JOIN irs990_xml_returns x ON x.return_pk = r.object_id
WHERE r.ein = '262633965'
LIMIT 5;
```

(Adjust column names if your `irs_filings_raw` uses different identifiers.)

---

## 7. Older TEOS XML (e.g. 2017–2019) vs newer (2024+)

The parser normalizes common differences:

| Topic | What varies | Handling |
|-------|-------------|----------|
| **501(c) type** | Newer: `Organization501c3Ind` = `X`. Older: `Organization501cInd` with **`@organization501cTypeTxt`** (e.g. `5` for farm bureaus) | `organization_501c_type_txt` stores the digit; `organization_501c3_ind` is **1** only for subsection **3** (including inferred `"3"` from the (c)(3) checkbox). |
| **Books in care of** | Often `BusinessName`; many older filings use **`PersonNm`** only | `books_in_care_of_name` prefers business name, then person name. |
| **Part VII flags** | Usually `X`; some software used `true` / `false` | `truthyInd` treats `X`, `true`, and `"true"` as yes. |
| **Net assets** | Usually `NetAssetsOrFundBalances*Amt`; alternate presentations use `TotalNetAssetsFundBalanceGrp` or `RtnEarnEndowmentIncmOthFndsGrp` | `pickNetAssets` falls back to those groups when BOY/EOY primary fields are empty. |
| **Membership / benefits** | 501(c)(5)/(6)-style orgs | `membership_dues_amt`, `py/cy_benefits_paid_to_members_amt` when elements exist. |

---

## 8. Extending further

The parser is **`scripts/parse-irs990-xml.mjs`**. To add fields (e.g. Schedule D asset breakdown, program service descriptions in Part III), extend:

1. `schema-irs990-xml.sql` (columns or child tables)
2. `extractReturnRow` / `buildInsertSql` in the script

`fast-xml-parser` preserves IRS element names; grep the XML for the tags you need.
