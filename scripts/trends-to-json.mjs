#!/usr/bin/env node
/**
 * Convert gtrends-csv output (CSV per group + summary.json) into the JSON the
 * dashboard serves at /data/*.json.
 *
 * Usage: node scripts/trends-to-json.mjs --in ./trends-out --out dashboard/public/data
 *
 * Imports the repo's own tested CSV parser (src/parse.js) — no Playwright needed.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, basename, isAbsolute } from 'node:path';
import { parseTrendsCsv } from '../src/parse.js';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const config = JSON.parse(readFileSync(new URL('../trends.config.json', import.meta.url), 'utf8'));
const inDir = resolve(arg('--in', './trends-out'));
const outDir = resolve(arg('--out', './dashboard/public/data'));
mkdirSync(outDir, { recursive: true });

const summary = JSON.parse(readFileSync(join(inDir, 'summary.json'), 'utf8'));

// Resolve a csvPath robustly: absolute, relative-to-cwd, or inside inDir.
function resolveCsv(p) {
  const candidates = isAbsolute(p) ? [p] : [resolve(p), join(inDir, p), join(inDir, basename(p))];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error(`CSV not found for path: ${p}`);
}

// Index every keyword across all group CSVs.
const byKeyword = new Map(); // keyword -> { weeks, values, partial }
for (const group of summary.groups) {
  if (group.error || !group.csvPath) continue;
  const parsed = parseTrendsCsv(readFileSync(resolveCsv(group.csvPath), 'utf8'));
  for (const kw of parsed.header) {
    byKeyword.set(kw, { weeks: parsed.weeks, values: parsed.series[kw], partial: !!group.partial });
  }
}

const terms = [];
const missing = [];
for (const t of config.terms) {
  const hit = byKeyword.get(t.keyword);
  if (!hit) {
    missing.push(t.keyword);
    continue;
  }
  // Week labels look like "2025-06-01 - 2025-06-07" — keep the start date.
  const weeks = hit.weeks.map((w) => w.split(' ')[0]);
  writeFileSync(
    join(outDir, `${t.id}.json`),
    JSON.stringify({ id: t.id, keyword: t.keyword, weeks, values: hit.values })
  );
  terms.push({
    id: t.id,
    label: t.label,
    query: t.query,
    sector: t.sector,
    keyword: t.keyword,
    weeks: weeks.length,
    partial: hit.partial,
  });
}

const manifest = {
  updatedAt: new Date().toISOString(),
  timeframe: config.timeframe,
  geo: config.geo,
  terms,
};
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`Wrote ${terms.length} term files + manifest.json to ${outDir}`);
if (missing.length) {
  console.error(`MISSING keywords (not found in any CSV): ${missing.join(', ')}`);
  process.exitCode = 1;
}
