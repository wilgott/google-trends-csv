import type { TermData } from '../lib/data';
import { fmtPct, fmtIdx, fmtScore, SIGNAL_TEXT, SIGNAL_GLYPH, SIGNAL_CLASS } from '../lib/data';

function Meter({ label, value, display }: { label: string; value: number; display: string }) {
  const cells = 14;
  const on = Math.round(Math.min(Math.max(value, 0), 1) * cells);
  return (
    <div className="meter">
      <span className="meter-label">{label}</span>
      <span className="meter-cells">
        {Array.from({ length: cells }).map((_, i) => (
          <span key={i} className={`cell${i < on ? ' on' : ''}`} />
        ))}
      </span>
      <span className="meter-val">{display}</span>
    </div>
  );
}

export function DetailPanel({ term }: { term: TermData }) {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const scoreCells = 24;
  const scoreOn = Math.round(term.score * scoreCells);

  return (
    <div className="pane-body">
      {/* current level */}
      <div className="dt-block solid-sep">
        <span className="label">Search Index · Now</span>
        <div className="dt-index-row" style={{ marginTop: 10 }}>
          <span className="dt-big">{fmtIdx(term.now)}</span>
          <span className={`sig sig-lg ${SIGNAL_CLASS[term.signal]}`}>
            {SIGNAL_GLYPH[term.signal]} {SIGNAL_TEXT[term.signal]}
          </span>
        </div>
        <div className="dt-sub">
          <span className="label">0 = no interest · 100 = peak</span>
          <span className="label">W32 · 09 AUG 26</span>
        </div>
      </div>

      {/* sub-indicators */}
      <div className="dt-block">
        <span className="label">Sub-Indicators</span>
        <div style={{ marginTop: 6 }}>
          <Meter label="YoY Momentum" value={clamp01((term.yoy + 25) / 50)} display={fmtPct(term.yoy)} />
          <Meter label="13W Rate of Chg" value={clamp01((term.roc13 + 12) / 24)} display={fmtPct(term.roc13)} />
          <Meter label="5Y Percentile" value={term.pctl} display={`${(term.pctl * 100).toFixed(0)}th`} />
          <Meter label="Seasonal Surprise" value={clamp01((term.surprise + 2) / 4)} display={`${term.surprise >= 0 ? '+' : ''}${term.surprise.toFixed(1)}σ`} />
        </div>
      </div>

      {/* composite */}
      <div className="dt-block">
        <span className="label">Composite Signal Score</span>
        <div className="score-row" style={{ marginTop: 10 }}>
          <span className="score-num">{fmtScore(term.score)}</span>
          <span className="score-bar">
            {Array.from({ length: scoreCells }).map((_, i) => (
              <span key={i} className={`cell${i < scoreOn ? ' on' : ''}`} />
            ))}
          </span>
          <span className="label">/100</span>
        </div>
        <div className="dt-sub">
          <span className="label">Bullish ≥ 62</span>
          <span className="label">Bearish ≤ 42</span>
        </div>
      </div>

      {/* desk note */}
      <div className="dt-block" style={{ borderBottom: 'none' }}>
        <div className="note-box">
          <span className="label">Desk Note</span>
          <div className="note-text">{term.def.note}</div>
          <span className="label">What Invalidates It</span>
          <div className="note-text">{term.def.risk}</div>
        </div>
      </div>
    </div>
  );
}
