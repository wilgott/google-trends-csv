/* Rule-based pattern interpreter.
   Classifies a term from its computed indicators and generates a desk note
   plus an invalidation condition. Deterministic: same metrics → same read. */

import type { TermData } from './data';
import { fmtPct } from './data';

export type Pattern =
  | 'EVENT_SPIKE'
  | 'STRUCTURAL_UP'
  | 'LATE_CYCLE'
  | 'BREAKDOWN'
  | 'RECOVERY'
  | 'SEASONAL_NORM'
  | 'NEUTRAL_DRIFT';

export interface Interpretation {
  pattern: Pattern;
  title: string;
  note: string;
  invalidates: string;
}

const PATTERN_TITLE: Record<Pattern, string> = {
  EVENT_SPIKE: 'Event-Driven Spike',
  STRUCTURAL_UP: 'Structural Uptrend',
  LATE_CYCLE: 'Late-Cycle Plateau',
  BREAKDOWN: 'Persistent Decline',
  RECOVERY: 'Early Inflection',
  SEASONAL_NORM: 'Seasonal Norm — No Signal',
  NEUTRAL_DRIFT: 'No Edge',
};

export function interpret(t: TermData): Interpretation {
  const n = t.series.length;
  const last = n - 1;

  // shape of the last 13 weeks: where did the recent peak occur?
  const recent = t.series.slice(Math.max(last - 12, 0));
  const peakOffset = recent.indexOf(Math.max(...recent)); // 0..12 within window
  const weeksSincePeak = recent.length - 1 - peakOffset;

  const pctl100 = Math.round(t.pctl * 100);
  const z = t.surprise;

  let pattern: Pattern;
  if (z >= 1.5 && weeksSincePeak >= 2 && weeksSincePeak <= 8 && (t.roc13 >= 5 || t.yoy >= 12)) {
    pattern = 'EVENT_SPIKE';
  } else if (t.pctl >= 0.75 && t.yoy >= 8 && t.roc13 > -2) {
    pattern = 'STRUCTURAL_UP';
  } else if (t.pctl >= 0.7 && t.roc13 < -2) {
    pattern = 'LATE_CYCLE';
  } else if (t.pctl <= 0.2 && t.roc13 <= -3) {
    pattern = 'BREAKDOWN';
  } else if (t.pctl <= 0.4 && t.roc13 >= 5 && t.yoy > -8) {
    pattern = 'RECOVERY';
  } else if (Math.abs(z) < 1 && Math.abs(t.roc13) < 5) {
    pattern = 'SEASONAL_NORM';
  } else {
    pattern = 'NEUTRAL_DRIFT';
  }

  let note: string;
  let invalidates: string;
  switch (pattern) {
    case 'EVENT_SPIKE':
      note = `Interest spiked ${z.toFixed(1)}σ above the seasonal norm but peaked ${weeksSincePeak} weeks ago and is already rolling over (13W ROC ${fmtPct(t.roc13)}). This shape is almost always event-driven — weather, news, or a one-off catalyst. Treat as transient unless a hard data source (claims, permits, sales) confirms lasting demand.`;
      invalidates = 'Invalidated if the index holds above the band for 2+ more months (the event became a trend), or confirmed if it re-enters the band within a quarter.';
      break;
    case 'STRUCTURAL_UP':
      note = `Clean demand formation: ${pctl100}th percentile of its own history, up ${fmtPct(t.yoy)} YoY, with momentum intact. Each seasonal high is exceeding the prior one. This is the pattern worth paying attention to — but check what the market already prices in before acting.`;
      invalidates = 'Invalidated when YoY momentum breaks below zero or a seasonal high fails to exceed the previous one.';
      break;
    case 'LATE_CYCLE':
      note = `Level is still high (${pctl100}th percentile) but momentum has rolled over (13W ROC ${fmtPct(t.roc13)}). The classic late-cycle shape: everyone who wanted to search has already searched. High level plus deceleration is a warning, not an entry.`;
      invalidates = 'Invalidated if 13-week ROC re-accelerates above +5% for a full quarter — the plateau was a pause, not a top.';
      break;
    case 'BREAKDOWN':
      note = `Pinned near the bottom of its 5-year range (${pctl100}th percentile) with no momentum inflection (13W ROC ${fmtPct(t.roc13)}). Cheap can get cheaper — there is no turn in this data yet.`;
      invalidates = 'Invalidated on a sustained 13W ROC above +5%, ideally paired with a macro catalyst (rate cuts, subsidies).';
      break;
    case 'RECOVERY':
      note = `Still low in its range (${pctl100}th percentile) but momentum has turned up (13W ROC ${fmtPct(t.roc13)}). Early inflections fail often — this is a watch-and-confirm, not an act.`;
      invalidates = 'Invalidated if ROC slips back below zero within a quarter; upgraded to structural if percentile clears 60 with YoY positive.';
      break;
    case 'SEASONAL_NORM':
      note = `Inside the seasonal band (${z >= 0 ? '+' : ''}${z.toFixed(1)}σ) with flat momentum. Nothing here — movement matches the calendar, not a demand shift. A dashboard that flags everything flags nothing.`;
      invalidates = 'Re-evaluate only if the index exits the climatology band.';
      break;
    case 'NEUTRAL_DRIFT':
      note = `Mixed signals: ${pctl100}th percentile, ${fmtPct(t.yoy)} YoY, ${fmtPct(t.roc13)} over 13 weeks. No coherent pattern — the trend exists but the timing signal does not. Wait for the sub-indicators to align.`;
      invalidates = 'Re-evaluate when YoY momentum, ROC and percentile point the same direction for 4+ weeks.';
      break;
  }

  return { pattern, title: PATTERN_TITLE[pattern], note, invalidates };
}
