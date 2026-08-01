# google-trends-csv

Google Trends CSV extractor that works when API wrappers get blocked.

## Why this exists

The unofficial Google Trends libraries are all currently broken:

- **pytrends** (Python) — fails with HTTP 429 and HTML block pages
- **google-trends-api** (npm) — same 429/block responses
- **gtrendsR** (R) — same story

Google's bot detection rejects the request patterns these wrappers use: they hit
undocumented JSON endpoints directly with plain HTTP clients, and Google now
refuses those requests regardless of headers, proxies, or retries.

This package takes the route that works: it launches a **real Chrome browser**
(via Playwright, `channel: 'chrome'`) on `trends.google.com`, lets the site load
normally, and clicks the site's **own CSV export button** on the
interest-over-time widget. To Google, the session looks like what it is — a
browser visiting Google Trends — and the CSV is a first-party download, not a
scraped endpoint. This approach is proven in daily production use.

Trade-off: it's slower and heavier than an HTTP call (a real browser starts up),
and headed mode is the most reliable. That's the price of working at all.

## Requirements

- Node.js 18+
- Google **Chrome** installed (Playwright drives the real browser, not Chromium)

## Install

```bash
npm install google-trends-csv
```

Single runtime dependency: `playwright`.

## CLI

```bash
npx gtrends-csv "link shortener,url shortener" "a/b testing,split test" \
  --timeframe "today 12-m" --geo NO --out ./trends/
```

Each positional argument is one **keyword group** (comma-separated, max 5 per
group — Google's compare limit). The CLI writes one CSV per group plus a
`summary.json`, and prints a compact stats table:

```
keyword                         mean  last4wk    max
----------------------------------------------------
link shortener                  47.3    49.3     55
url shortener                   33.3    38.0     42
```

Options: `--timeframe` (default `today 12-m`), `--geo` (default worldwide),
`--hl` (default `en`), `--out`, `--profile` (reuse a Chrome profile to skip
repeated cookie consent), `--headless`, `--timeout` (ms), `--help`.

## Library

```js
import { exportTrends, parseTrendsCsv, summarizeTrends } from 'google-trends-csv';

const { csvPaths, summary } = await exportTrends({
  keywords: ['link shortener', 'url shortener'], // flat list, or [['a','b'],['c']] for explicit groups
  timeframe: 'today 12-m',
  geo: 'NO',          // '' = worldwide
  hl: 'en',
  headless: false,    // headed Chrome is the most reliable; default
  profileDir: './.trends-profile',
  outDir: './trends',
});

// summary.groups[i] -> { keywords, csvPath, partial, stats, error }
```

`exportTrends` downloads one CSV per group, parses it, and attaches per-keyword
stats (`mean`, `last4wkMean`, `max`) to the summary. Groups that Google flags
with a "not enough data" notice are marked `partial: true`; groups whose
download fails get a clear `error` message instead of throwing mid-batch.

### Parsing CSVs you already have

```js
import { parseTrendsCsv, summarizeTrends } from 'google-trends-csv';
import { readFileSync } from 'node:fs';

const parsed = parseTrendsCsv(readFileSync('trends/link_shortener.csv', 'utf8'));
// -> { header: [...keywords], weeks: [...labels], series: { keyword: [0-100, ...] } }

const stats = summarizeTrends(parsed);
// -> { keyword: { mean, last4wkMean, max } }
```

Google writes `<1` for sub-1% volume; the parser maps it to `0`.

## Output format

Per group, a standard Google Trends export:

```csv
Category: All categories

Week,link shortener,url shortener
2025-06-01 - 2025-06-07,42,38
2025-06-08 - 2025-06-14,45,<1
```

## IMPORTANT: never compare numbers across groups

Google Trends normalizes every request to 0–100, where **100 is the peak of the
most-searched keyword in that group, in that timeframe and region**. Two
different groups are normalized against different peaks and are **not on the
same scale**.

Example: group A is `["link shortener", "url shortener"]` and group B is
`["google"]`. "url shortener" at 42 in group A means 42% of the peak *within
group A*. "google" at 100 in group B is the peak *within group B*. You cannot
conclude that "google" is ~2.4x "url shortener" — the denominators differ. To
compare keywords, put them in the **same group** (max 5), or use one shared
anchor keyword repeated in every group and rescale manually.

## Responsible use

This package drives a **real browser against a free Google service**. Please:

- Keep request volume low — batch your keywords into as few groups as possible.
- Don't parallelize runs or hammer the site; a handful of groups per run is the
  intended scale.
- Reuse `profileDir` so consent and session state persist between runs.
- Google can still block abusive traffic; if that happens, slow down — this
  package is not a way around rate limits, just around broken API wrappers.

## Troubleshooting

- **Consent page loops / download never starts** — the stored profile is in a
  bad state. Delete the profile dir (default: temp dir, or your `--profile`
  path) and rerun; consent will be accepted once and remembered.
- **`CSV download did not start within ...ms`** — likely rate-limiting. Wait,
  retry headed, reduce group count.
- **Browser opens but nothing happens** — Google changed the page layout. The
  CSV button selector lives in `src/export.js`; please open an issue/PR.
- **Headless fails but headed works** — expected in some environments; headed
  (`headless: false`, the default) is the reliable path.

## Development

```bash
npm install
npm test        # node --test, no network access
```

Tests cover the CSV parser (including `<1` handling), explore-URL building, and
keyword grouping. No live extraction runs in tests.

## See also

- [backlink-agent](https://github.com/wilgott/backlink-agent) — agent that automates directory backlink submissions
- [awesome-scout](https://github.com/wilgott/awesome-scout) — scout agent for finding awesome-list placement opportunities

## License

MIT — Robin Wilgott
