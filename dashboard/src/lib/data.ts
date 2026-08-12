/* TrendSignal — simulated search-interest dataset + indicator engine.
   All series are synthetic: trend + seasonality + seeded noise + event shocks. */

export type Signal = 'BULL' | 'NEUT' | 'BEAR';

export interface EventShock {
  week: number; // absolute week index 0..260
  height: number; // amplitude in index points (can be negative)
  width: number; // gaussian sigma in weeks
}

export interface TermDef {
  id: string;
  label: string; // display name
  query: string; // the actual search query
  sector: string;
  seed: number;
  base: number; // starting index level
  drift: number; // index points per week (structural trend)
  plateauAfter?: number; // optional week index where the drift stops
  amp: number; // seasonal amplitude
  phase: number; // week-of-year of seasonal peak
  noise: number; // random-walk sigma
  shocks: EventShock[];
  note: string; // desk note
  risk: string; // what invalidates the signal
}

export interface TermData {
  def: TermDef;
  series: number[]; // 261 weekly points, 0..100
  bandHi: number[]; // seasonal climatology + 1 sigma
  bandLo: number[]; // seasonal climatology - 1 sigma
  now: number;
  yoy: number; // % vs 52 weeks ago
  roc13: number; // % vs 13 weeks ago
  pctl: number; // 5-year percentile 0..1
  surprise: number; // z-score vs seasonal expectation
  score: number; // composite 0..1
  signal: Signal;
}

export const WEEKS = 261; // 5 years + 1 week
export const END_DATE = new Date(2026, 7, 9); // Sun 09 Aug 2026 (W32)

/* ---------- deterministic PRNG ---------- */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- series generation ---------- */
function genSeries(d: TermDef): number[] {
  const rnd = mulberry32(d.seed);
  const out: number[] = [];
  let walk = 0;
  for (let w = 0; w < WEEKS; w++) {
    const woy = w % 52;
    walk += (rnd() - 0.5) * 2 * d.noise;
    walk *= 0.96; // mean-reverting noise
    const driftW = d.plateauAfter !== undefined ? Math.min(w, d.plateauAfter) : w;
    let v =
      d.base +
      d.drift * driftW +
      d.amp * Math.cos(((woy - d.phase) / 52) * Math.PI * 2) +
      walk;
    for (const s of d.shocks) {
      const x = (w - s.week) / s.width;
      v += s.height * Math.exp(-0.5 * x * x);
    }
    out.push(Math.min(99, Math.max(3, v)));
  }
  return out;
}

/* ---------- seasonal climatology (week-of-year mean ± 1σ) ---------- */
function climatology(series: number[]): { hi: number[]; lo: number[]; mean: number[]; sd: number[] } {
  const hi: number[] = new Array(WEEKS).fill(0);
  const lo: number[] = new Array(WEEKS).fill(0);
  const mean: number[] = new Array(WEEKS).fill(0);
  const sd: number[] = new Array(WEEKS).fill(1);
  for (let k = 0; k < 52; k++) {
    const vals: number[] = [];
    for (let w = k; w < WEEKS; w += 52) vals.push(series[w]);
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const s = Math.sqrt(vals.reduce((a, b) => a + (b - m) * (b - m), 0) / vals.length);
    for (let w = k; w < WEEKS; w += 52) {
      mean[w] = m;
      sd[w] = Math.max(s, 1.2);
      hi[w] = Math.min(100, m + sd[w]);
      lo[w] = Math.max(0, m - sd[w]);
    }
  }
  return { hi, lo, mean, sd };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function buildTerm(def: TermDef): TermData {
  const series = genSeries(def);
  const clim = climatology(series);
  const last = WEEKS - 1;
  const now = series[last];
  const yoy = ((now - series[last - 52]) / series[last - 52]) * 100;
  const roc13 = ((now - series[last - 13]) / series[last - 13]) * 100;
  const pctl = series.filter((v) => v <= now).length / WEEKS;
  const surprise = (now - clim.mean[last]) / clim.sd[last];

  const nYoy = clamp01((yoy + 25) / 50);
  const nRoc = clamp01((roc13 + 12) / 24);
  const nSurp = clamp01((surprise + 2) / 4);
  const score = 0.3 * nYoy + 0.25 * nRoc + 0.25 * pctl + 0.2 * nSurp;
  const signal: Signal = score >= 0.62 ? 'BULL' : score <= 0.42 ? 'BEAR' : 'NEUT';

  return { def, series, bandHi: clim.hi, bandLo: clim.lo, now, yoy, roc13, pctl, surprise, score, signal };
}

/* ---------- tracked universe (simulated) ---------- */
const DEFS: TermDef[] = [
  {
    id: 'roof', label: 'Roof Repair', query: '"roof repair near me"', sector: 'Home Services',
    seed: 11, base: 30, drift: 0.05, amp: 13, phase: 17, noise: 1.6,
    shocks: [
      { week: 120, height: 16, width: 3 }, // 2023 storm season
      { week: 253, height: 15, width: 5 }, // May-2026 hail corridor
    ],
    note: 'Search interest is running well above the 5-year seasonal norm after the May hail corridor across TX/OK/CO. Demand is real but event-driven and regional. Public roofing names trade primarily on housing starts and insurance claim cycles — search volume is a demand proxy, not an earnings proxy.',
    risk: 'Storm-driven spikes mean-revert within 1–2 quarters. Signal invalidates if index re-enters the climatology band before Q4, or if insurer claim counts do not confirm.',
  },
  {
    id: 'heatpump', label: 'Heat Pumps', query: '"heat pump installation cost"', sector: 'HVAC / Energy',
    seed: 23, base: 18, drift: 0.105, amp: 10, phase: 2, noise: 1.4,
    shocks: [{ week: 90, height: 12, width: 6 }],
    note: 'Multi-year structural uptrend with winter-seasonal peaks. Subsidy programs keep the drift positive; each seasonal high has exceeded the prior one. Unlike event spikes, this curve shows persistent demand formation.',
    risk: 'Subsidy withdrawal or rate-driven housing slowdown flattens the drift. Watch permitting data as confirmation.',
  },
  {
    id: 'battery', label: 'Home Batteries', query: '"home battery storage"', sector: 'Energy Storage',
    seed: 37, base: 7, drift: 0.15, amp: 6, phase: 44, noise: 1.2,
    shocks: [{ week: 235, height: 9, width: 5 }],
    note: 'Low absolute level but compounding steadily off a small base. Percentile at cycle highs. The pattern resembles heat pumps three years ago — early-stage adoption S-curve.',
    risk: 'Small base amplifies percentage reads. Absolute search volume still niche; invalidate if drift stalls below prior highs.',
  },
  {
    id: 'usedfurn', label: 'Second-Hand Furniture', query: '"used furniture near me"', sector: 'Consumer / Recommerce',
    seed: 41, base: 26, drift: 0.1, amp: 7, phase: 20, noise: 1.5,
    shocks: [],
    note: 'Quiet structural climb — consumer trade-down behavior plus recommerce normalization. Low noise, high R² trend. No single catalyst; this is a slow compounder signal.',
    risk: 'A strong consumer cycle reverses trade-down demand. Watch discretionary spending prints.',
  },
  {
    id: 'unempl', label: 'Unemployment Benefits', query: '"file for unemployment"', sector: 'Macro / Labor',
    seed: 53, base: 30, drift: 0.02, amp: 5, phase: 2, noise: 1.8,
    shocks: [{ week: 244, height: 21, width: 7 }],
    note: 'Search demand is elevated — but read this as a macro warning, not a long signal. Rising claims interest historically precedes softening labor prints. Bullish for job-board traffic, bearish for the broad tape.',
    risk: 'If initial claims data does not follow within 4–6 weeks, the spike is noise (media-driven, not layoff-driven).',
  },
  {
    id: 'glp1', label: 'Weight-Loss Drugs', query: '"weight loss injection"', sector: 'Healthcare',
    seed: 67, base: 12, drift: 0.16, plateauAfter: 205, amp: 3, phase: 30, noise: 1.2,
    shocks: [],
    note: 'The strongest structural trend in the universe has gone flat for over a year. Absolute level remains in the top quartile of its range, but momentum has rolled over to zero. Classic late-cycle signal shape: high level, decelerating growth.',
    risk: 'Already crowded. Momentum reversal from extreme levels tends to overshoot. Supply expansion news could re-accelerate either way.',
  },
  {
    id: 'evcharg', label: 'Home EV Charging', query: '"home ev charger install"', sector: 'Auto / Energy',
    seed: 74, base: 21, drift: 0.03, amp: 8, phase: 20, noise: 1.2,
    shocks: [],
    note: 'Positive drift but noisy, with momentum oscillating around zero. The trend exists; the timing signal does not. Neutral until 13-week ROC holds above zero for a full quarter.',
    risk: 'EV adoption headlines whipsaw this series. Signal quality is low — high noise-to-trend ratio.',
  },
  {
    id: 'petins', label: 'Pet Insurance', query: '"pet insurance worth it"', sector: 'Insurance',
    seed: 83, base: 41, drift: 0.005, amp: 6, phase: 20, noise: 1.0,
    shocks: [],
    note: 'Textbook neutral: flat drift, clean seasonality, price mid-range. Nothing here. Included as a control — a dashboard that flags everything flags nothing.',
    risk: 'None. That is the point of a control series.',
  },
  {
    id: 'solar', label: 'Residential Solar', query: '"solar panel cost"', sector: 'Energy',
    seed: 89, base: 56, drift: -0.062, amp: 10, phase: 22, noise: 1.5,
    shocks: [{ week: 160, height: -10, width: 8 }],
    note: 'Persistent two-year decline from cycle highs. Rate sensitivity crushed financing-driven demand. Percentile in the bottom quintile with no momentum inflection. Cheap can get cheaper.',
    risk: 'Invalidate on rate cuts re-accelerating financing volumes, or a sustained 13-week ROC above +5%.',
  },
  {
    id: 'refi', label: 'Mortgage Refinance', query: '"mortgage refinance rates"', sector: 'Financials / Housing',
    seed: 97, base: 46, drift: -0.05, amp: 4, phase: 20, noise: 2.0,
    shocks: [{ week: 130, height: 12, width: 4 }],
    note: 'Pinned near 5-year lows. This is a pure rate-expectation series — it will not drift, it will gap. The option value is in being early to the turn, but there is no turn in the data yet.',
    risk: 'A sharp rate rally gaps this series vertically with no warning. Position sizing matters more than signal here.',
  },
  {
    id: 'diy', label: 'DIY Renovation', query: '"diy kitchen renovation"', sector: 'Retail / Home Imp.',
    seed: 103, base: 60, drift: -0.085, amp: 9, phase: 20, noise: 1.4,
    shocks: [],
    note: 'Post-pandemic normalization continues to grind lower. Every seasonal peak since 2022 has been lower than the last. Professional contractor searches (see Roof Repair) are taking share from DIY intent.',
    risk: 'Signal is mature — most of the decline is done. Further downside is limited; covering is a valuation call, not a trend call.',
  },
];

export const TERMS: TermData[] = DEFS.map(buildTerm);

/* ---------- formatting helpers ---------- */
export function dateOf(weekIdx: number): Date {
  const d = new Date(END_DATE);
  d.setDate(d.getDate() - (WEEKS - 1 - weekIdx) * 7);
  return d;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function fmtDate(weekIdx: number): string {
  const d = dateOf(weekIdx);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

export function fmtMonthYear(weekIdx: number): string {
  const d = dateOf(weekIdx);
  return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

export function fmtYear(weekIdx: number): string {
  return String(dateOf(weekIdx).getFullYear());
}

export const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
export const fmtIdx = (v: number) => v.toFixed(1);
export const fmtScore = (v: number) => (v * 100).toFixed(0);

export const SIGNAL_TEXT: Record<Signal, string> = { BULL: 'BULLISH', NEUT: 'NEUTRAL', BEAR: 'BEARISH' };
export const SIGNAL_GLYPH: Record<Signal, string> = { BULL: '▲', NEUT: '—', BEAR: '▼' };
export const SIGNAL_CLASS: Record<Signal, string> = { BULL: 'sig-bull', NEUT: 'sig-neut', BEAR: 'sig-bear' };
