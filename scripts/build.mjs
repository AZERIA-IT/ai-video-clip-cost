// Builds data/clip-cost.csv, data/clip-cost.json and index.html for the
// dataset repo. No number is typed by hand.
//
// Source of the rows: the CSV file the Twistavo site itself serves at
// https://twistavo.com/pricing/clip-cost/data.csv (clipCostCsv(clipCostTable())
// in src/lib/seo/clip-cost-dataset.js). The rows cannot be recomputed outside
// production: each price is a live AI Studio quote that depends on the
// production configuration (price table, rollout flags), which this script
// never reads. The CSV header is checked against the column list below, or
// against the site's own list when TWISTAVO_CHECKOUT points to a checkout.
//
// Usage:
//   node scripts/build.mjs                       # fetch the live CSV
//   node scripts/build.mjs --csv path/to/file.csv # use a saved copy of it
//   TWISTAVO_CHECKOUT=/path/to/twistavo node scripts/build.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SITE = process.env.TWISTAVO_CHECKOUT ? resolve(process.env.TWISTAVO_CHECKOUT) : null;
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_URL = "https://twistavo.com/pricing/clip-cost";
const DATA_URL = `${SOURCE_URL}/data`;
const CSV_URL = `${SOURCE_URL}/data.csv`;
const MAX_HTML_BYTES = 60 * 1024;

const argCsv = (() => {
  const i = process.argv.indexOf("--csv");
  return i > 0 ? process.argv[i + 1] : null;
})();

// Expected CSV columns (same order as the site's CLIP_COST_CSV_COLUMNS).
const COLUMNS = [
  "model_id", "model_name", "family", "resolution", "sound", "plan",
  "plan_price_usd_per_month", "plan_credits_per_month", "usd_per_credit",
  "clip_5s_credits", "clip_5s_usd", "clip_10s_credits", "clip_10s_usd", "price_date",
];

// With a Twistavo checkout, the site's own list is used instead. The site
// modules import TypeScript and extensionless paths, so the site's test loader
// is registered first, as its tests do.
async function siteColumns() {
  if (!SITE) return COLUMNS;
  const site = (p) => import(pathToFileURL(join(SITE, p)).href);
  process.env.NODE_ENV = "test";
  const { installUiSsrLoader } = await site("tests/helpers/ui-ssr-loader.mjs");
  const loader = installUiSsrLoader();
  const { CLIP_COST_CSV_COLUMNS } = await site("src/lib/seo/clip-cost-dataset.js");
  loader.deregister();
  return CLIP_COST_CSV_COLUMNS;
}
const CLIP_COST_CSV_COLUMNS = await siteColumns();

async function sourceCsv() {
  if (argCsv) return readFileSync(argCsv, "utf8");
  const response = await fetch(CSV_URL, { headers: { "User-Agent": "ai-video-clip-cost-dataset-build" } });
  if (!response.ok) throw new Error(`${CSV_URL} answered ${response.status}: nothing written`);
  return response.text();
}

// RFC 4180 parser (quoted fields, doubled quotes, CRLF or LF).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const csv = await sourceCsv();
const [header, ...lines] = parseCsv(csv);
if (JSON.stringify(header) !== JSON.stringify(CLIP_COST_CSV_COLUMNS))
  throw new Error(`CSV header differs from the site's columns: ${header.join(",")}`);
if (!lines.length) throw new Error("CSV holds no row: nothing written");
const records = lines.map((fields, n) => {
  if (fields.length !== header.length) throw new Error(`row ${n + 2}: ${fields.length} fields`);
  return Object.fromEntries(header.map((column, i) => [column, fields[i]]));
});
const dates = [...new Set(records.map((r) => r.price_date))];
if (dates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) throw new Error(`bad price_date: ${dates}`);
const priceDate = dates.sort().at(-1);

mkdirSync(join(OUT, "data"), { recursive: true });
// The site's file, byte for byte: same columns, same values, same rounding.
writeFileSync(join(OUT, "data/clip-cost.csv"), csv);
writeFileSync(
  join(OUT, "data/clip-cost.json"),
  `${JSON.stringify(
    {
      name: "AI video clip cost dataset",
      source: SOURCE_URL,
      source_data: DATA_URL,
      source_csv: CSV_URL,
      license: "CC BY 4.0",
      attribution: `Twistavo, ${SOURCE_URL}`,
      price_date: priceDate,
      columns: header,
      rows: records,
    },
    null,
    2,
  )}\n`,
);

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const head = header.map((c) => `<th>${esc(c)}</th>`).join("");
const body = records.map((r) => `<tr>${header.map((c) => `<td>${esc(r[c])}</td>`).join("")}</tr>`).join("\n");
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI video clip cost dataset</title>
<meta name="description" content="Credits and US dollar cost of one AI video clip per model on Twistavo, prices dated ${esc(priceDate)}. CC BY 4.0.">
<style>
body{font-family:system-ui,sans-serif;margin:2rem auto;max-width:72rem;padding:0 1rem;color:#111;line-height:1.5}
table{border-collapse:collapse;font-size:.85rem;display:block;overflow-x:auto}
th,td{border:1px solid #ccc;padding:.3rem .5rem;text-align:left;white-space:nowrap}
th{background:#f3f3f3}
</style>
</head>
<body>
<h1>AI video clip cost dataset</h1>
<p>Cost of one AI video clip per model on Twistavo, in credits and US dollars: ${records.length} rows, one per model and plan, prices dated ${esc(priceDate)}.</p>
<p>Source: <a href="${SOURCE_URL}">${SOURCE_URL}</a>. Data: <a href="data/clip-cost.csv">clip-cost.csv</a> (also <a href="data/clip-cost.json">JSON</a>). License: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, attribution "Twistavo, ${SOURCE_URL}".</p>
<table>
<thead><tr>${head}</tr></thead>
<tbody>
${body}
</tbody>
</table>
</body>
</html>
`;
if (Buffer.byteLength(html) > MAX_HTML_BYTES) throw new Error(`index.html is ${Buffer.byteLength(html)} bytes, over 60 KB`);
writeFileSync(join(OUT, "index.html"), html);
console.log(`rows=${records.length} price_date=${priceDate} html_bytes=${Buffer.byteLength(html)}`);
