import { useId } from 'react';
import { motion } from 'framer-motion';

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
}

/** Мини-SVG-график эквити: линия accent 1.5px, заливка 8%, пульсирующая последняя точка. */
export default function Sparkline({ points, width = 120, height = 40, className }: SparklineProps) {
  const gid = useId().replace(/[:]/g, '');

  if (points.length < 2) {
    return (
      <img
        src="/empty-chart.svg"
        alt="График пока пуст — накапливаем данные"
        width={width}
        height={height}
        className={className}
        style={{ objectFit: 'cover', opacity: 0.7 }}
      />
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 3;
  const iw = width - pad * 2;
  const ih = height - pad * 2;
  const stepX = iw / (points.length - 1);
  const coords = points.map((p, i) => [
    pad + i * stepX,
    pad + ih - ((p - min) / span) * ih,
  ]);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${(pad + iw).toFixed(1)} ${height} L${pad} ${height} Z`;
  const [lx, ly] = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="Мини-график эквити"
    >
      <defs>
        <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6D8DFF" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#6D8DFF" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${gid})`} />
      <motion.path
        d={line}
        fill="none"
        stroke="#6D8DFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      <circle cx={lx} cy={ly} r="3" fill="#6D8DFF">
        <animate attributeName="r" values="3;4.4;3" dur="1.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
