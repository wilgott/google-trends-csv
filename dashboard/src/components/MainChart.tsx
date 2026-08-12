import { useEffect, useRef, useState } from 'react';
import type { TermData } from '../lib/data';
import { fmtDate, fmtMonthYear, fmtYear, fmtIdx, fmtPct } from '../lib/data';

interface Props {
  term: TermData;
  range: '1Y' | '5Y';
}

const PADL = 46;
const PADR = 18;
const PADT = 20;
const PADB = 30;

export function MainChart({ term, range }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 820, h: 420 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => setHover(null), [term.def.id, range]);

  const { w: W, h: H } = size;
  const total = term.series.length;
  const start = range === '1Y' ? Math.max(total - 53, 0) : 0;
  const idx: number[] = [];
  for (let i = start; i < total; i++) idx.push(i);
  const n = idx.length;

  const plotW = Math.max(W - PADL - PADR, 10);
  const plotH = Math.max(H - PADT - PADB, 10);
  const x = (i: number) => PADL + ((i - start) / (n - 1)) * plotW;
  const y = (v: number) => PADT + (1 - v / 100) * plotH;

  const seriesPath = idx.map((i, k) => `${k === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(term.series[i]).toFixed(1)}`).join(' ');
  const bandPath =
    idx.map((i, k) => `${k === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(term.bandHi[i]).toFixed(1)}`).join(' ') +
    ' ' +
    [...idx].reverse().map((i, k) => `${k === 0 ? 'L' : 'L'}${x(i).toFixed(1)},${y(term.bandLo[i]).toFixed(1)}`).join(' ') +
    ' Z';

  // x-axis ticks
  const ticks: { i: number; label: string }[] = [];
  if (range === '5Y') {
    const marks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => Math.round(f * (total - 1)));
    [...new Set(marks)].filter((i) => i >= start).forEach((i) => ticks.push({ i, label: fmtYear(term, i) }));
  } else {
    for (let i = start; i < total; i += 9) ticks.push({ i, label: fmtMonthYear(term, i) });
    ticks.push({ i: total - 1, label: fmtMonthYear(term, total - 1) });
  }

  const last = total - 1;
  const hoverI = hover !== null ? idx[Math.min(Math.max(hover, 0), n - 1)] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const k = Math.round(((px - PADL) / plotW) * (n - 1));
    setHover(Math.min(Math.max(k, 0), n - 1));
  };

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <pattern id="hatchBand" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="none" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--hatch)" strokeWidth="2.5" />
          </pattern>
        </defs>

        {/* y gridlines */}
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={PADL} y1={y(g)} x2={W - PADR} y2={y(g)} stroke={g === 0 ? 'var(--fg)' : 'var(--grid)'} strokeWidth="1" />
            <text x={PADL - 8} y={y(g) + 3} textAnchor="end" fontSize="9.5" fill="var(--muted)" fontFamily="'JetBrains Mono', monospace">
              {g}
            </text>
          </g>
        ))}

        {/* x ticks */}
        {ticks.map((t, k) => (
          <text
            key={k}
            x={Math.min(Math.max(x(t.i), PADL + 16), W - PADR - 20)}
            y={H - 10}
            textAnchor="middle"
            fontSize="9.5"
            fill="var(--muted)"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="1"
          >
            {t.label}
          </text>
        ))}

        {/* seasonal expectation band */}
        <path d={bandPath} fill="url(#hatchBand)" stroke="none" />
        <path
          d={idx.map((i, k) => `${k === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(term.bandHi[i]).toFixed(1)}`).join(' ')}
          fill="none" stroke="var(--faint)" strokeWidth="1" strokeDasharray="4 3"
        />
        <path
          d={idx.map((i, k) => `${k === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(term.bandLo[i]).toFixed(1)}`).join(' ')}
          fill="none" stroke="var(--faint)" strokeWidth="1" strokeDasharray="4 3"
        />

        {/* series */}
        <path d={seriesPath} fill="none" stroke="var(--fg)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />

        {/* last point */}
        <circle cx={x(last)} cy={y(term.now)} r="3.4" fill="var(--fg)" />
        <circle cx={x(last)} cy={y(term.now)} r="7" fill="none" stroke="var(--fg)" strokeWidth="1" opacity="0.35">
          <animate attributeName="r" values="4;9;4" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2.2s" repeatCount="indefinite" />
        </circle>

        {/* crosshair */}
        {hoverI !== null && (
          <g>
            <line x1={x(hoverI)} y1={PADT} x2={x(hoverI)} y2={H - PADB} stroke="var(--fg)" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={x(hoverI)} cy={y(term.series[hoverI])} r="3.4" fill="var(--bg)" stroke="var(--fg)" strokeWidth="1.6" />
          </g>
        )}
      </svg>

      {hoverI !== null && (
        <div
          className="chart-tip"
          style={{
            left: `${(x(hoverI) / W) * 100}%`,
            top: `${(y(term.series[hoverI]) / H) * 100}%`,
          }}
        >
          <div style={{ color: 'var(--muted)' }}>{fmtDate(term, hoverI)}</div>
          <div><b>{fmtIdx(term.series[hoverI])}</b> INDEX</div>
          <div style={{ color: 'var(--muted)' }}>
            BAND {fmtIdx(term.bandLo[hoverI])}–{fmtIdx(term.bandHi[hoverI])}
            {hoverI >= 52 ? ` · YOY ${fmtPct(((term.series[hoverI] - term.series[hoverI - 52]) / term.series[hoverI - 52]) * 100)}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
