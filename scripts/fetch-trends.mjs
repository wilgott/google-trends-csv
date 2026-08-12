#!/usr/bin/env node
/**
 * Fetch Google Trends data for all configured keywords.
 *
 * Uses the google-trends-csv library in this repo (real Chrome via Playwright).
 * Designed to run inside GitHub Actions under `xvfb-run -a` (headed Chrome is
 * the reliable path; the runner provides the display).
 *
 * Fetch mode: Google currently fails to render compare widgets (multi-keyword
 * explore pages show "something went wrong" from datacenter IPs), while
 * single-keyword pages export fine. Since every dashboard indicator is
 * computed within-term (percentile, YoY, seasonal band — never cross-keyword),
 * we fetch one keyword per page. Set TRENDS_FETCH_MODE=group to go back to
 * compare groups if Google restores them.
 *
 * Usage: node scripts/fetch-trends.mjs [outDir]
 * Output: <outDir>/*.csv (one per keyword) + <outDir>/summary.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { exportTrends } from '../src/index.js';

const config = JSON.parse(readFileSync(new URL('../trends.config.json', import.meta.url), 'utf8'));
const outDir = resolve(process.argv[2] || './trends-out');
mkdirSync(outDir, { recursive: true });

const fetchMode = process.env.TRENDS_FETCH_MODE || 'single';
const fetchGroups =
  fetchMode === 'group' ? config.groups : config.groups.flat().map((keyword) => [keyword]);

console.log(`Fetching ${fetchGroups.length} pages (${config.groups.flat().length} keywords, mode: ${fetchMode})`);
console.log(`timeframe: ${config.timeframe} · geo: ${config.geo || 'worldwide'} · hl: ${config.hl}`);

const { summary } = await exportTrends({
  keywords: fetchGroups,
  timeframe: config.timeframe,
  geo: config.geo,
  hl: config.hl,
  headless: false, // headed Chrome under xvfb is the reliable path
  profileDir: process.env.TRENDS_PROFILE || './.trends-profile',
  outDir,
  onProgress: (msg) => console.log(`  › ${msg}`),
});

writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));

let failures = 0;
for (const g of summary.groups) {
  const status = g.error ? `ERROR: ${g.error}` : g.partial ? 'partial (low data)' : 'ok';
  if (g.error) failures++;
  console.log(`  [${status}] ${g.keywords.join(', ')}`);
}
console.log(`Done. ${summary.groups.length - failures}/${summary.groups.length} pages exported to ${outDir}`);
if (failures > 0) process.exitCode = 1;
