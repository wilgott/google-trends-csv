# TrendSignal — Search-Trends Indicator Dashboard

A monochrome, analyst-style dashboard that turns Google Trends–style search
interest into research signals. Built to pair with the
[`google-trends-csv`](../) data tool in this repo.

**All data currently shipped in the dashboard is simulated** (deterministic,
seeded synthetic series in `src/lib/data.ts`). The indicator engine is real —
swap the synthetic series for actual CSV output from `google-trends-csv` to go
live.

## What it shows

- **Watchlist** — tracked search queries with 5-year sparklines, current index,
  YoY change, 5-year percentile and a composite signal (BULLISH / NEUTRAL / BEARISH)
- **Main chart** — 5Y/1Y search-interest index with a seasonal expectation band
  (week-of-year climatology ±1σ) and crosshair inspection
- **Indicator breakdown** — sub-indicator meters (YoY momentum, 13-week
  rate-of-change, percentile, seasonal surprise z-score), composite score,
  desk note and invalidation criteria per term

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
4. Deploy. Every push to `main` that touches `dashboard/` rebuilds automatically.

> Note: `package-lock.json` is intentionally not committed — Cloudflare runs a
> fresh `npm install`.

## Swap in real data

The data layer is isolated in `src/lib/data.ts`:

- `TermDef` describes a tracked query (label, sector, desk notes)
- `buildTerm()` computes the seasonal band and all indicators from a weekly
  0–100 series
- Replace `genSeries()` output with parsed CSV rows from `google-trends-csv`
  (or fetch them at runtime from a Pages Function / Worker) — the rest of the
  UI needs no changes

## Disclaimer

Search interest ≠ revenue. Nothing here is investment advice.
