import { TERMS, fmtPct, SIGNAL_TEXT, SIGNAL_GLYPH } from '../lib/data';

export function Ticker() {
  const items = TERMS.map(
    (t) => `${t.def.label} ${fmtIdx2(t.now)} ${fmtPct(t.yoy)} YOY ${SIGNAL_GLYPH[t.signal]} ${SIGNAL_TEXT[t.signal]}`
  );
  const line = (prefix: string) =>
    items.map((s, i) => (
      <span className="ticker-item" key={`${prefix}${i}`}>
        {s} <span className="ticker-sep">◆</span>
      </span>
    ));
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {line('a')}
        {line('b')}
      </div>
    </div>
  );
}

const fmtIdx2 = (v: number) => v.toFixed(1);
