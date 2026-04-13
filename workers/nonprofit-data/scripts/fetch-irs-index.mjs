#!/usr/bin/env node
/**
 * Streams IRS TEOS index CSVs (2019–2026 by default) and writes batched SQL for D1.
 * This loads the **full** IRS bulk index (every filing row) into `irs_filings_raw`.
 * You do NOT need the multi‑GB ZIP/XML bundles for this step — the index CSV is the manifest.
 *
 * Usage:
 *   npm run irs:index -- --out ./irs-out
 *   npm run irs:index -- --years 2024,2025 --out ./irs-out
 *
 * Apply to D1 (remote example) — run the ein-years filler **last**:
 *   for f in ./irs-out/batch-*.sql; do wrangler d1 execute nonprofit-990 --remote --file="$f"; done
 *   wrangler d1 execute nonprofit-990 --remote --file=./irs-out/zzz-fill-irs-ein-years.sql
 *
 * @see ../IRS-INDEX.md
 */

import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as csvParse } from "csv-parse";
import { Readable } from "node:stream";

const DEFAULT_YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const BATCH_SIZE = 120;

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i === -1) return def;
  return process.argv[i + 1] ?? def;
}

function parseYears(s) {
  if (!s) return DEFAULT_YEARS;
  return s
    .split(",")
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

/** SQLite string literal */
function q(s) {
  if (s == null || s === undefined) return "''";
  return `'${String(s).replace(/'/g, "''")}'`;
}

async function streamYearToSql(year, outDir, batchIndexRef) {
  const url = `https://apps.irs.gov/pub/epostcard/990/xml/${year}/index_${year}.csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  if (!res.body) throw new Error(`${url}: empty body`);

  const nodeReadable = Readable.fromWeb(res.body);
  const parser = nodeReadable.pipe(
    csvParse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }),
  );

  let batch = [];
  let rows = 0;
  const uniqueEin = new Set();

  async function flush() {
    if (batch.length === 0) return;
    const n = ++batchIndexRef.n;
    const path = join(outDir, `batch-${String(n).padStart(5, "0")}.sql`);
    const ws = createWriteStream(path, { flags: "w" });
    ws.write("BEGIN TRANSACTION;\n");
    for (const line of batch) {
      ws.write(line + "\n");
    }
    ws.write("COMMIT;\n");
    await new Promise((resolve, reject) => {
      ws.end((err) => (err ? reject(err) : resolve()));
    });
    batch = [];
  }

  for await (const row of parser) {
    const oid = row.OBJECT_ID ?? row.object_id;
    const rawEin = row.EIN ?? row.ein;
    if (oid == null || String(oid).trim() === "" || rawEin == null) continue;
    const ein = String(rawEin).replace(/\D/g, "");
    if (ein.length !== 9) continue;

    uniqueEin.add(ein);
    rows++;

    const rid = row.RETURN_ID ?? row.return_id ?? "";

    const line = `INSERT OR IGNORE INTO irs_filings_raw (object_id, return_id, filing_type, ein, tax_period, sub_date, taxpayer_name, return_type, dln, xml_batch_id, index_year) VALUES (${q(
      String(oid),
    )}, ${q(rid)}, ${q(row.FILING_TYPE ?? row.filing_type)}, ${q(ein)}, ${q(row.TAX_PERIOD ?? row.tax_period)}, ${q(
      row.SUB_DATE ?? row.sub_date,
    )}, ${q(row.TAXPAYER_NAME ?? row.taxpayer_name)}, ${q(row.RETURN_TYPE ?? row.return_type)}, ${q(
      row.DLN ?? row.dln,
    )}, ${q(row.XML_BATCH_ID ?? row.xml_batch_id)}, ${year});`;

    batch.push(line);
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  return { rows, uniqueEin: uniqueEin.size };
}

async function main() {
  const out = arg("--out", "./irs-index-out");
  const years = parseYears(arg("--years", null));
  await mkdir(out, { recursive: true });

  const batchIndexRef = { n: 0 };
  const summary = [];

  console.error(`Writing SQL batches to ${out} (years: ${years.join(", ")})`);

  for (const year of years) {
    process.stderr.write(`  ${year} … `);
    const t0 = Date.now();
    const { rows, uniqueEin } = await streamYearToSql(year, out, batchIndexRef);
    summary.push({ year, filingRows: rows, distinctEin: uniqueEin, ms: Date.now() - t0 });
    console.error(`${rows} filing rows, ~${uniqueEin} distinct EINs (${Date.now() - t0}ms)`);
  }

  const fillSql = `BEGIN TRANSACTION;
INSERT OR IGNORE INTO irs_ein_years (ein, year)
SELECT DISTINCT ein, index_year FROM irs_filings_raw;
COMMIT;
`;
  const fillPath = join(out, "zzz-fill-irs-ein-years.sql");
  await writeFile(fillPath, fillSql, "utf8");

  const manifestPath = join(out, "manifest.json");
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        years: summary,
        generatedAt: new Date().toISOString(),
        applyOrder: [
          "Run all batch-*.sql in order",
          `Then run ${fillPath} to populate irs_ein_years from irs_filings_raw`,
        ],
      },
      null,
      2,
    ),
  );

  const totalFilings = summary.reduce((a, s) => a + s.filingRows, 0);
  console.error(
    `Done. ${batchIndexRef.n} SQL batch files, ${totalFilings} filing rows. Run ${fillPath} last. Manifest: ${manifestPath}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
