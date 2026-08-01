#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { exportTrends } from '../src/index.js';

const USAGE = `gtrends-csv — Google Trends CSV export via a real Chrome session

Usage:
  gtrends-csv "kw1,kw2" ["kw3,kw4" ...] [options]

  Each positional argument is one keyword group (comma-separated, max 5).
  Indexes are normalized 0-100 WITHIN a group — never compare across groups.

Options:
  --timeframe <tf>   e.g. "today 12-m" (default), "today 5-y", "now 7-d"
  --geo <code>       two-letter region code, e.g. NO, US (default: worldwide)
  --hl <locale>      UI locale (default: en)
  --out <dir>        output directory (default: ./trends)
  --profile <dir>    Chrome profile dir (default: temp dir; reuse avoids re-consent)
  --headless         run headless (headed is more reliable; use if you must)
  --timeout <ms>     download timeout per group (default: 20000)
  -h, --help         show this help

Example:
  gtrends-csv "link shortener,url shortener" "a/b testing,split test" --geo NO --out ./trends/
`;

function parseArgs(argv) {
  const groups = [];
  const opts = {
    timeframe: 'today 12-m',
    geo: '',
    hl: 'en',
    outDir: './trends',
    profileDir: undefined,
    headless: false,
    downloadTimeout: 20000,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`missing value for ${arg}`);
      return argv[++i];
    };
    switch (arg) {
      case '-h':
      case '--help':
        return { help: true };
      case '--timeframe': opts.timeframe = next(); break;
      case '--geo': opts.geo = next(); break;
      case '--hl': opts.hl = next(); break;
      case '--out': opts.outDir = next(); break;
      case '--profile': opts.profileDir = next(); break;
      case '--timeout': opts.downloadTimeout = Number(next()); break;
      case '--headless': opts.headless = true; break;
      default:
        if (arg.startsWith('--')) throw new Error(`unknown option: ${arg}`);
        groups.push(arg.split(',').map((s) => s.trim()).filter(Boolean));
    }
  }

  return { help: false, groups, opts };
}

function printTable(summary) {
  console.log('\nkeyword'.padEnd(28) + 'mean'.padStart(8) + 'last4wk'.padStart(9) + 'max'.padStart(7));
  console.log('-'.repeat(52));
  for (const group of summary.groups) {
    if (group.error) {
      console.log(`${group.keywords.join(', ')}: ERROR: ${group.error}`);
      continue;
    }
    for (const [kw, s] of Object.entries(group.stats)) {
      console.log(kw.slice(0, 27).padEnd(28) + String(s.mean).padStart(8) + String(s.last4wkMean).padStart(9) + String(s.max).padStart(7));
    }
    if (group.partial) console.log('  (note: Google flagged this group as having partial/low-volume data)');
    console.log('');
  }
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}\n`);
    console.log(USAGE);
    process.exit(2);
  }

  if (parsed.help) {
    console.log(USAGE);
    return;
  }
  if (parsed.groups.length === 0) {
    console.error('Error: provide at least one keyword group, e.g. gtrends-csv "kw1,kw2"\n');
    console.log(USAGE);
    process.exit(2);
  }

  const { groups, opts } = parsed;
  console.log(`Exporting ${groups.length} group(s), timeframe "${opts.timeframe}"${opts.geo ? `, geo ${opts.geo}` : ''} ...`);

  const { csvPaths, summary } = await exportTrends({
    keywords: groups,
    ...opts,
    onProgress: (msg) => console.log(`  ${msg}`),
  });

  const summaryPath = join(resolve(opts.outDir), 'summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  printTable(summary);
  console.log(`Wrote ${csvPaths.length} CSV(s) + ${summaryPath}`);

  const failures = summary.groups.filter((g) => g.error);
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
