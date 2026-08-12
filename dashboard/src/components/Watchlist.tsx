import type { TermData } from '../lib/data';
import { fmtPct, fmtIdx, SIGNAL_TEXT, SIGNAL_CLASS } from '../lib/data';
import { Sparkline } from './Sparkline';

interface Props {
  terms: TermData[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function Watchlist({ terms, selectedId, onSelect }: Props) {
  return (
    <>
      <div className="wl-head">
        <span className="label">Search Term</span>
        <span className="label">5Y Trend</span>
        <span className="label r">Now</span>
        <span className="label r wl-hide">YoY</span>
        <span className="label r wl-hide">%ile</span>
        <span className="label r">Signal</span>
      </div>
      <div className="pane-body">
        {terms.map((t) => (
          <div
            key={t.def.id}
            className={`wl-row${t.def.id === selectedId ? ' selected' : ''}`}
            onClick={() => onSelect(t.def.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(t.def.id)}
          >
            <span style={{ minWidth: 0 }}>
              <span className="wl-name" style={{ display: 'block' }}>{t.def.label}</span>
              <span className="wl-query" style={{ display: 'block' }}>{t.def.query}</span>
            </span>
            <Sparkline series={t.series} signal={t.signal} width={84} />
            <span className="wl-num">{fmtIdx(t.now)}</span>
            <span className="wl-num wl-hide">{fmtPct(t.yoy)}</span>
            <span className="wl-num wl-hide">{(t.pctl * 100).toFixed(0)}</span>
            <span style={{ textAlign: 'right' }}>
              <span className={`sig ${SIGNAL_CLASS[t.signal]}`}>{SIGNAL_TEXT[t.signal]}</span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
