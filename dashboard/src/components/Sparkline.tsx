import type { Signal } from '../lib/data';

interface Props {
  series: number[];
  signal: Signal;
  width?: number;
  height?: number;
}

/* Sparkline — monochrome encoding:
   BULL = solid full-weight line, NEUT = thin muted line, BEAR = dashed line. */
export function Sparkline({ series, signal, width = 92, height = 26 }: Props) {
  const n = series.length;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(max - min, 1);
  const x = (i: number) => (i / (n - 1)) * (width - 4) + 2;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lastX = x(n - 1);
  const lastY = y(series[n - 1]);

  const strokeProps =
    signal === 'BULL'
      ? { strokeWidth: 1.6, strokeDasharray: undefined, opacity: 1 }
      : signal === 'BEAR'
        ? { strokeWidth: 1.4, strokeDasharray: '3 2', opacity: 1 }
        : { strokeWidth: 1.1, strokeDasharray: undefined, opacity: 0.55 };

  return (
    <svg width={width} height={height} style={{ display: 'block' }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" {...strokeProps} />
      <circle cx={lastX} cy={lastY} r={1.8} fill="currentColor" />
    </svg>
  );
}
