export function PriceChart({
  points,
  height = 240,
}: {
  points: Array<{ t: number; v: number }>;
  height?: number;
}): JSX.Element {
  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-border text-sm text-faint"
        style={{ height }}
      >
        No trades yet — the chart fills in as the coin trades.
      </div>
    );
  }

  const w = 1000;
  const h = height;
  const pad = 8;
  const vs = points.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const range = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * (w - pad * 2) + pad;
  const y = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`;
  const last = points[points.length - 1]!;
  const up = last.v >= points[0]!.v;
  const stroke = up ? '#34E5A4' : '#FF6B6B';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaFill)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(last.v)} r="4" fill={stroke} />
    </svg>
  );
}
