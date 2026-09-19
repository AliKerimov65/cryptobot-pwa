import { useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

const START_EQUITY = 1000;
const W = 720;
const H = 240;
const PAD = { t: 16, r: 10, b: 22, l: 10 };

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

interface EquityCurveChartProps {
  points: number[];
  peak: number;
}

/**
 * Кривая эквити конвейера (собственный SVG): линия accent + градиентная заливка,
 * пунктиры «старт 1000» и «пик эквити», полоса MaxDD, кроссхейр с тултипом.
 */
export default function EquityCurveChart({ points, peak }: EquityCurveChartProps) {
  const gid = useId().replace(/[:]/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const lo0 = Math.min(...points, START_EQUITY, peak);
    const hi0 = Math.max(...points, START_EQUITY, peak);
    const span0 = hi0 - lo0 || 1;
    const lo = lo0 - span0 * 0.06;
    const hi = hi0 + span0 * 0.06;
    const span = hi - lo;
    const iw = W - PAD.l - PAD.r;
    const ih = H - PAD.t - PAD.b;
    const x = (i: number) => PAD.l + (i / (points.length - 1)) * iw;
    const y = (v: number) => PAD.t + ih - ((v - lo) / span) * ih;

    // Пара «пик → дно» максимальной просадки
    let runPeak = points[0];
    let runPeakIdx = 0;
    let bestDd = 0;
    let ddFrom = 0;
    let ddTo = 0;
    points.forEach((p, i) => {
      if (p > runPeak) {
        runPeak = p;
        runPeakIdx = i;
      }
      const dd = runPeak > 0 ? (runPeak - p) / runPeak : 0;
      if (dd > bestDd) {
        bestDd = dd;
        ddFrom = runPeakIdx;
        ddTo = i;
      }
    });

    const coords = points.map((p, i) => [x(i), y(p)] as const);
    const line = coords
      .map(([cx, cy], i) => `${i === 0 ? 'M' : 'L'}${cx.toFixed(1)} ${cy.toFixed(1)}`)
      .join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)} ${(PAD.t + ih).toFixed(1)} L${PAD.l} ${(PAD.t + ih).toFixed(1)} Z`;

    return { coords, line, area, y, lo, hi, bestDd, ddFrom, ddTo };
  }, [points, peak]);

  if (!geo) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <img src="/empty-chart.svg" alt="График пока пуст" width={240} height={120} />
        <p className="text-[12px] text-faint">
          Кривая появится после первых закрытых сделок конвейера
        </p>
      </div>
    );
  }

  const { coords, line, area, y, lo, hi, bestDd, ddFrom, ddTo } = geo;
  const hoverPt = hover != null ? coords[hover] : null;
  const hoverVal = hover != null ? points[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const iw = W - PAD.l - PAD.r;
    const idx = Math.round(((px - PAD.l) / iw) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, idx)));
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        role="img"
        aria-label="Кривая эквити конвейера"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`eq-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6D8DFF" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#6D8DFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Полоса MaxDD: пик → дно просадки */}
        {bestDd > 0 && ddTo > ddFrom && (
          <g>
            <rect
              x={coords[ddFrom][0]}
              y={PAD.t}
              width={Math.max(2, coords[ddTo][0] - coords[ddFrom][0])}
              height={H - PAD.t - PAD.b}
              fill="#F87171"
              opacity="0.08"
            />
            <text
              x={(coords[ddFrom][0] + coords[ddTo][0]) / 2}
              y={PAD.t + 10}
              textAnchor="middle"
              className="fill-down"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              MaxDD −{(bestDd * 100).toFixed(1)}%
            </text>
          </g>
        )}

        {/* Пунктир: старт 1000 USDT */}
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={y(START_EQUITY)}
          y2={y(START_EQUITY)}
          stroke="#5A6378"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <text
          x={W - PAD.r}
          y={y(START_EQUITY) - 4}
          textAnchor="end"
          fontSize="10"
          className="fill-faint"
          fontFamily="JetBrains Mono, monospace"
        >
          старт {fmt(START_EQUITY, 0)}
        </text>

        {/* Пунктир: пик эквити */}
        {peak > START_EQUITY && (
          <g>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(peak)}
              y2={y(peak)}
              stroke="#34D399"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.7"
            />
            <text
              x={W - PAD.r}
              y={y(peak) - 4}
              textAnchor="end"
              fontSize="10"
              className="fill-up"
              fontFamily="JetBrains Mono, monospace"
            >
              пик {fmt(peak)}
            </text>
          </g>
        )}

        {/* Заливка + линия */}
        <motion.path
          d={area}
          fill={`url(#eq-${gid})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke="#6D8DFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />

        {/* Кроссхейр */}
        {hoverPt && (
          <g>
            <line
              x1={hoverPt[0]}
              x2={hoverPt[0]}
              y1={PAD.t}
              y2={H - PAD.b}
              stroke="#6D8DFF"
              strokeWidth="1"
              opacity="0.4"
            />
            <circle cx={hoverPt[0]} cy={hoverPt[1]} r="3.5" fill="#6D8DFF" />
          </g>
        )}

        {/* Метки диапазона */}
        <text
          x={PAD.l}
          y={H - 6}
          fontSize="10"
          className="fill-faint"
          fontFamily="JetBrains Mono, monospace"
        >
          {fmt(lo, 0)}
        </text>
        <text
          x={W - PAD.r}
          y={H - 6}
          textAnchor="end"
          fontSize="10"
          className="fill-faint"
          fontFamily="JetBrains Mono, monospace"
        >
          {fmt(hi, 0)}
        </text>
      </svg>

      {/* Тултип кроссхейра */}
      {hoverPt && hoverVal != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-subtle bg-[#0D1017] px-2.5 py-1.5 text-center shadow-lg transition-opacity duration-100"
          style={{ left: `${(hoverPt[0] / W) * 100}%` }}
        >
          <div className="font-mono text-[12px] font-semibold text-primary2">
            {fmt(hoverVal)} USDT
          </div>
          <div className="font-mono text-[10px] text-faint">
            точка {hover! + 1} · от пика{' '}
            {peak > 0 ? `${(((hoverVal - peak) / peak) * 100).toFixed(2)}%` : '—'}
          </div>
        </div>
      )}
    </div>
  );
}
