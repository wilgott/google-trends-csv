# TrendSignal — Search-Trends Indicator Dashboard

A monochrome, analyst-style dashboard that turns Google Trends search interest
into research signals. Powered by the [`google-trends-csv`](../) extractor in
this repo.

## How it gets data

```
GitHub Action (weekly cron / manual dispatch)
  → real Chrome on trends.google.com (google-trends-csv)
  → CSV per keyword group
  → scripts/trends-to-json.mjs
  → dashboard/public/data/*.json + manifest.json  (committed to main)
  → Cloudflare Pages rebuild
  → dashboard fetches /data/manifest.json at runtime
```

- **Pipeline config:** [`trends.config.json`](../trends.config.json) — keyword
  groups (fixed across runs to keep normalization comparable), timeframe,
  geo, and per-term display metadata. Edit it to track your own themes.
- **Workflow:** [`.github/workflows/update-trends.yml`](../.github/workflows/update-trends.yml).
  Runs Mondays 05:23 UTC; trigger manually anytime via
  **Actions → update-trends → Run workflow**.
- **Fallback:** if no live data has been published yet, the dashboard renders a
  clearly-labeled **simulated** demo universe so the UI is never empty.
  The header badge shows **LIVE** or **SIMULATED** accordingly.

## What it shows

- **Watchlist** — tracked queries with 5-year sparklines, current index, YoY,
  percentile and a composite signal (BULLISH / NEUTRAL / BEARISH)
- **Main chart** — 5Y/1Y search-interest index with a seasonal expectation band
  (week-of-year climatology ±1σ) and crosshair inspection
- **Indicator breakdown** — sub-indicator meters (YoY momentum, 13-week
  rate-of-change, percentile, seasonal surprise z-score), composite score
- **Pattern Read · Auto** — a rule-based interpreter (`src/lib/interpret.ts`)
  classifies each term into a named pattern (event-driven spike, structural
  uptrend, late-cycle plateau, persistent decline, early inflection, seasonal
  norm) and generates a desk note + invalidation condition. Deterministic:
  same metrics → same read. Curated analyst notes can be layered on top via
  `note`/`risk` in the config.

### Signal construction

Composite score = 30% YoY momentum + 25% 13-week ROC + 25% 5-year percentile +
20% seasonal surprise. Bullish ≥ 62, bearish ≤ 42.

### Monochrome encoding (no color)

- **BULLISH** — solid black badge, full-weight line
- **NEUTRAL** — hatched badge, thin muted line
- **BEARISH** — outline badge, dashed line

Paper (white) and Terminal (black) themes via the header toggle.

## Stack

React 19 + TypeScript + Vite 7 + Tailwind CSS 3. Charts are hand-rolled SVG
(no chart library). Fonts: Inter + JetBrains Mono.

## Develop

```bash
npm install
npm run dev
```

To test live-data mode locally, drop a `manifest.json` + term files into
`public/data/` (shape documented in `scripts/trends-to-json.mjs`).

## Deploy to Cloudflare Pages

This app lives in the `dashboard/` subdirectory of the repo.

1. **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**
   and select `wilgott/google-trends-csv`.
2. Build settings:
   - **Framework preset:** `Vite` (or `None`)
   - **Root directory:** `dashboard`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Add environment variable `NODE_VERSION = ` `22` (Vite 7 requires Node ≥ 20.19;
   the included `.nvmrc` also pins 22).
4. Deploy. Every push to `main` — including the weekly data commit — rebuilds
   automatically.

> Note: `package-lock.json` is intentionally not committed — Cloudflare runs a
> fresh `npm install`.

## Disclaimer

Search interest ≠ revenue. Nothing here is investment advice.
