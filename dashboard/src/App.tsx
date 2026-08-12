import { useEffect, useMemo, useState } from 'react';
import { TERMS, fmtIdx, fmtPct, SIGNAL_CLASS, SIGNAL_TEXT } from './lib/data';
import { Ticker } from './components/Ticker';
import { Watchlist } from './components/Watchlist';
import { MainChart } from './components/MainChart';
import { DetailPanel } from './components/DetailPanel';

function Logo() {
  return (
    <svg className="hdr-logo" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <rect x="1" y="1" width="28" height="28" fill="none" stroke="var(--fg)" strokeWidth="2" />
      <polyline points="5,22 10,16 14,19 19,9 25,13" fill="none" stroke="var(--fg)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="25" cy="13" r="2.6" fill="var(--fg)" />
    </svg>
  );
}

export default function App() {
  const [selectedId, setSelectedId] = useState('roof');
  const [range, setRange] = useState<'1Y' | '5Y'>('5Y');
  const [inverted, setInverted] = useState(false);
  const [clock, setClock] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('invert', inverted);
  }, [inverted]);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      setClock(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const term = useMemo(() => TERMS.find((t) => t.def.id === selectedId) ?? TERMS[0], [selectedId]);
  const counts = useMemo(
    () => ({
      bull: TERMS.filter((t) => t.signal === 'BULL').length,
      neut: TERMS.filter((t) => t.signal === 'NEUT').length,
      bear: TERMS.filter((t) => t.signal === 'BEAR').length,
    }),
    []
  );

  return (
    <div className="app">
      {/* ===== Header ===== */}
      <header className="hdr">
        <div className="hdr-left">
          <Logo />
          <div>
            <div className="hdr-title">TRENDSIGNAL</div>
            <div className="hdr-sub">Search-Interest Indicators · Equity Research</div>
          </div>
        </div>
        <div className="hdr-mid">
          <span className="live-dot" />
          <span className="label" style={{ color: 'var(--fg)' }}>Monitoring {TERMS.length} search themes</span>
          <span className="label">·</span>
          <span className="label">{counts.bull} bullish / {counts.neut} neutral / {counts.bear} bearish</span>
        </div>
        <div className="hdr-right">
          <div className="hdr-cell">
            <span className="label">Session</span>
            <span className="hdr-clock">{clock}</span>
          </div>
          <div className="hdr-cell">
            <span className="label">Data</span>
            <span className="badge-sim">Simulated</span>
          </div>
          <div className="hdr-cell" style={{ padding: '8px 14px' }}>
            <button className="invert-btn" style={{ height: '100%' }} onClick={() => setInverted(!inverted)}>
              <span className="invert-icon" />
              {inverted ? 'Paper' : 'Terminal'}
            </button>
          </div>
        </div>
      </header>

      {/* ===== Ticker ===== */}
      <Ticker />

      {/* ===== Board ===== */}
      <main className="board">
        {/* Watchlist */}
        <section className="col-watch">
          <div className="pane-head">
            <span className="label" style={{ color: 'var(--fg)', fontWeight: 800 }}>Watchlist — Tracked Queries</span>
            <span className="label">Weekly · 0–100</span>
          </div>
          <div className="pane-body" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
            <Watchlist terms={TERMS} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </section>

        {/* Chart */}
        <section className="col-chart">
          <div className="chart-head">
            <div>
              <div className="chart-term">{term.def.label}</div>
              <div className="chart-meta">
                <span className="chip">{term.def.query}</span>
                <span className="chip">{term.def.sector}</span>
                <span className={`sig ${SIGNAL_CLASS[term.signal]}`}>{SIGNAL_TEXT[term.signal]}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
              <div style={{ textAlign: 'right' }}>
                <span className="label" style={{ display: 'block', marginBottom: 4 }}>Index · YoY {fmtPct(term.yoy)}</span>
                <span className="chart-now">{fmtIdx(term.now)}</span>
              </div>
              <div className="range-toggle">
                <button className={`range-btn${range === '1Y' ? ' active' : ''}`} onClick={() => setRange('1Y')}>1Y</button>
                <button className={`range-btn${range === '5Y' ? ' active' : ''}`} onClick={() => setRange('5Y')}>5Y</button>
              </div>
            </div>
          </div>
          <MainChart term={term} range={range} />
          <div className="chart-legend">
            <span className="leg">
              <svg className="leg-swatch"><line x1="0" y1="5" x2="22" y2="5" stroke="var(--fg)" strokeWidth="2" /></svg>
              <span className="label">Search Index</span>
            </span>
            <span className="leg">
              <svg className="leg-swatch">
                <rect width="22" height="10" fill="var(--hatch)" />
                <rect width="22" height="10" fill="none" stroke="var(--faint)" strokeWidth="1" strokeDasharray="3 2" />
              </svg>
              <span className="label">Seasonal Expectation ±1σ</span>
            </span>
            <span className="leg">
              <span className="label">Outside the band = non-seasonal demand shift</span>
            </span>
          </div>
        </section>

        {/* Detail */}
        <section className="col-detail">
          <div className="pane-head">
            <span className="label" style={{ color: 'var(--fg)', fontWeight: 800 }}>Indicator Breakdown</span>
            <span className="label">{term.def.id.toUpperCase()}-W32</span>
          </div>
          <DetailPanel term={term} />
        </section>
      </main>

      {/* ===== Methodology ===== */}
      <footer className="method">
        <div className="method-col">
          <h4>01 · Signal Construction</h4>
          <p>
            Composite of <b>YoY momentum (30%)</b>, <b>13-week rate-of-change (25%)</b>, <b>5-year percentile (25%)</b> and{' '}
            <b>seasonal surprise z-score (20%)</b>. Bullish ≥ 62, bearish ≤ 42. Levels mean little alone — a high index
            with decelerating momentum is a late-cycle warning, not a buy.
          </p>
        </div>
        <div className="method-col">
          <h4>02 · Seasonal Baseline</h4>
          <p>
            The hatched band is the <b>week-of-year climatology ±1σ</b> across five years. Spring roof-repair searches spike
            every spring — only a reading <b>outside the band</b> flags a genuine demand shift rather than calendar noise.
          </p>
        </div>
        <div className="method-col">
          <h4>03 · Limitations</h4>
          <p>
            Search interest ≠ revenue. Spikes can be event-driven, regional and transient, and one winner's anecdote is
            survivorship bias. Treat every signal as a screening question: <b>why is demand up, and is it already priced in?</b>{' '}
            All data here is simulated for demonstration — not investment advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
