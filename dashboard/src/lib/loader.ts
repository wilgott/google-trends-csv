/* Data loader: tries live Google Trends data published to /data/*.json
   (by the weekly GitHub Action), falls back to the simulated universe. */

import type { TermData, TermMeta } from './data';
import { SIMULATED_TERMS, buildTermFromSeries } from './data';

export interface LoadResult {
  terms: TermData[];
  live: boolean;
  updatedAt: string | null;
}

interface ManifestTerm extends TermMeta {
  keyword: string;
  weeks: number;
  partial: boolean;
}

interface Manifest {
  updatedAt: string;
  timeframe: string;
  geo: string;
  terms: ManifestTerm[];
}

interface TermFile {
  id: string;
  keyword: string;
  weeks: string[];
  values: number[];
}

export async function loadTerms(): Promise<LoadResult> {
  try {
    const res = await fetch('data/manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    const manifest = (await res.json()) as Manifest;
    if (!manifest.terms?.length) throw new Error('empty manifest');

    const terms = await Promise.all(
      manifest.terms.map(async (m) => {
        const r = await fetch(`data/${m.id}.json`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`term ${m.id} ${r.status}`);
        const j = (await r.json()) as TermFile;
        const meta: TermMeta = { id: m.id, label: m.label, query: m.query, sector: m.sector, note: m.note, risk: m.risk };
        return buildTermFromSeries(meta, j.values, j.weeks);
      })
    );

    return { terms, live: true, updatedAt: manifest.updatedAt };
  } catch {
    return { terms: SIMULATED_TERMS, live: false, updatedAt: null };
  }
}
