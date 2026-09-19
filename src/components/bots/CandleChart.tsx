import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Candle, KlineInterval } from '@/lib/bybit';
import { cn } from '@/lib/utils';
import { fmtPrice } from './format';

/**
 * Собственный свечной график (SVG, без библиотек):
 *  - ТФ-переключатель 1м/3м/5м/15м/30м/1ч (layoutId-подложка, spring 400/30);
 *  - 90 баров, фитили 1px, последняя свеча «дышит» (SMIL opacity 0.85↔1, 1s);
 *  - сетка + метки цены справа mono 10px, метки времени снизу;
 *  - линия текущей цены (accent + пилюля), пунктиры ждущих входов Л (зелёный) / Ш (красный),
 *    линии средней позиции сторон (точечный пунктир, толще);
 *  - кроссхейр (pointer) с OHLC-тултипом;
 *  - состояния: скелетон-шиммер / плашка REST-fallback / EmptyState.
 */

const BARS = 90;
const W = 720;
const H = 260;
const M = { top: 10, right: 66, bottom: 20, left: 4 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

const TF_LIST: { iv: KlineInterval; label: string }[] = [
  { iv: '1', label: '1м' },
  { iv: '3', label: '3м' },
  { iv: '5', label: '5м' },
  { iv: '15', label: '15м' },
  { iv: '30', label: '30м' },
  { iv: '60', label: '1ч' },
];

const LONG = '#34D399';
const SHORT = '#F87171';
const ACCENT = '#6D8DFF';
const GRID = '#1C2230';
const FAINT = '#5A6378';

export interface SideLine {
  avg: number;
  count: number;
}

interface CandleChartProps {
  candles: Record<KlineInterval, Candle[]>;
  price: number;
  pendingL: number | null;
  pendingS: number | null;
  posL: SideLine | null;
  posS: SideLine | null;
  restAvailable: boolean;
  online: boolean;
  symbol: string;
}

interface Crosshair {
  x: number;
  y: number;
  idx: number;
}

function fmtTime(t: number, iv: KlineInterval): string {
  const d = new Date(t);
  const hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (iv === '60') {
    const dm = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    return `${dm} ${hm}`;
  }
  return hm;
}

export default function CandleChart({
  candles,
  price,
  pendingL,
  pendingS,
  posL,
  posS,
  restAvailable,
  online,
  symbol,
}: CandleChartProps) {
  const [tf, setTf] = useState<KlineInterval>('15');
  const [cross, setCross] = useState<Crosshair | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const bars = useMemo(() => (candles[tf] ?? []).slice(-BARS), [candles, tf]);
  const hasData = bars.length > 0;
  const hasPrice = Number.isFinite(price) && price > 0;

  /* Диапазон цен с учётом оверлеев */
  const range = useMemo(() => {
    if (!hasData) return null;
    let lo = Infinity;
    let hi = -Infinity;
    for (const b of bars) {
      if (b.l < lo) lo = b.l;
      if (b.h > hi) hi = b.h;
    }
    const extras = [price, pendingL, pendingS, posL?.avg, posS?.avg];
    for (const v of extras) {
      if (v != null && Number.isFinite(v)) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (!(hi > lo)) hi = lo + 1;
    const pad = (hi - lo) * 0.06;
    return { lo: lo - pad, hi: hi + pad };
  }, [bars, hasData, price, pendingL, pendingS, posL, posS]);

  const yOf = (p: number): number =>
    range ? M.top + ((range.hi - p) / (range.hi - range.lo)) * PLOT_H : 0;

  const stepX = PLOT_W / BARS;
  const bodyW = Math.max(2, stepX * 0.62);
  // правое выравнивание: последний бар у правой кромки
  const xOf = (i: number): number => M.left + PLOT_W - (bars.length - i) * stepX + stepX / 2;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || !bars.length) return;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const vy = ((e.clientY - rect.top) / rect.height) * H;
    const i = Math.round((vx - M.left - PLOT_W) / stepX + bars.length - 0.5);
    const idx = Math.min(bars.length - 1, Math.max(0, i));
    setCross({
      x: Math.min(M.left + PLOT_W, Math.max(M.left, vx)),
      y: Math.min(M.top + PLOT_H, Math.max(M.top, vy)),
      idx,
    });
  };

  /* ---------- состояния без данных ---------- */
  const placeholder = (() => {
    if (hasData) return null;
    if (restAvailable && online) {
      // история ещё грузится — скелетон-шиммер
      return (
        <div className="flex h-[260px] flex-col justify-between rounded-xl border border-subtle bg-[#0E1219] p-4" aria-hidden>
          <div className="skeleton-shimmer h-3 w-28 rounded-md" />
          <div className="space-y-2.5">
            {[88, 74, 82, 60].map((w, i) => (
              <div key={i} className="skeleton-shimmer h-3.5 rounded-md" style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="skeleton-shimmer h-3 w-40 rounded-md" />
        </div>
      );
    }
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-subtle bg-[#0E1219] p-4">
        <img src="/empty-chart.svg" alt="" width={240} height={120} className="opacity-70" />
        <p className="text-[12px] text-faint">ждём первые тики…</p>
      </div>
    );
  })();

  const gridPrices = range
    ? Array.from({ length: 4 }, (_, i) => range.lo + ((range.hi - range.lo) * (i + 1)) / 5)
    : [];

  const crossBar = cross && bars[cross.idx] ? bars[cross.idx] : null;
  const crossUp = crossBar ? crossBar.c >= crossBar.o : true;
  const tooltipW = 168;
  const tooltipX = cross
    ? Math.min(W - tooltipW - 6, Math.max(6, cross.x + 14))
    : 0;
  const tooltipY = cross ? Math.min(H - 118, Math.max(6, cross.y - 20)) : 0;

  return (
    <div>
      {/* Переключатель ТФ */}
      <div className="mb-2 flex items-center justify-end gap-1">
        {TF_LIST.map(({ iv, label }) => {
          const active = tf === iv;
          return (
            <button
              key={iv}
              type="button"
              onClick={() => setTf(iv)}
              className={cn(
                'relative cursor-pointer rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors',
                active ? 'text-brand' : 'text-muted2 hover:text-primary2',
              )}
            >
              {active && (
                <motion.span
                  layoutId={`tf-pill-${symbol}`}
                  className="absolute inset-0 rounded-full border border-brand/40 bg-brand/15"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative">{label}</span>
            </button>
          );
        })}
      </div>

      {placeholder ?? (
        <div className="relative">
          {!restAvailable && (
            <span className="absolute left-2 top-2 z-10 rounded-md border border-warn/40 bg-warn/10 px-2 py-0.5 text-[10px] font-medium text-warn">
              история накапливается онлайн
            </span>
          )}
          <motion.div
            key={tf}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="block w-full cursor-crosshair select-none rounded-xl border border-subtle bg-[#0E1219]"
              style={{ height: 'auto' }}
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setCross(null)}
              role="img"
              aria-label={`Свечной график ${symbol}, таймфрейм ${tf}`}
            >
              {/* сетка + метки цены */}
              {gridPrices.map((p, i) => (
                <g key={i}>
                  <line x1={M.left} x2={M.left + PLOT_W} y1={yOf(p)} y2={yOf(p)} stroke={GRID} strokeWidth={1} />
                  <text x={W - 4} y={yOf(p) + 3} textAnchor="end" fontSize={10} fill={FAINT} fontFamily="JetBrains Mono, monospace">
                    {fmtPrice(p)}
                  </text>
                </g>
              ))}
              {/* метки времени */}
              {bars.length > 1 &&
                [0.05, 0.275, 0.5, 0.725, 0.95].map((f, i) => {
                  const bi = Math.min(bars.length - 1, Math.max(0, Math.round(f * (bars.length - 1))));
                  return (
                    <text
                      key={i}
                      x={xOf(bi)}
                      y={H - 6}
                      textAnchor="middle"
                      fontSize={10}
                      fill={FAINT}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {fmtTime(bars[bi].t, tf)}
                    </text>
                  );
                })}

              {/* свечи */}
              {bars.map((b, i) => {
                const up = b.c >= b.o;
                const color = up ? LONG : SHORT;
                const x = xOf(i);
                const yO = yOf(b.o);
                const yC = yOf(b.c);
                const top = Math.min(yO, yC);
                const h = Math.max(1, Math.abs(yC - yO));
                const body = (
                  <g key={b.t}>
                    <line x1={x} x2={x} y1={yOf(b.h)} y2={yOf(b.l)} stroke={color} strokeWidth={1} />
                    <rect x={x - bodyW / 2} y={top} width={bodyW} height={h} fill={color} rx={0.5} />
                  </g>
                );
                // последняя свеча «дышит»
                if (i === bars.length - 1) {
                  return (
                    <g key={b.t}>
                      {body}
                      <animate attributeName="opacity" values="0.85;1;0.85" dur="1s" repeatCount="indefinite" />
                    </g>
                  );
                }
                return body;
              })}

              {/* линия средней позиции стороны (точечный пунктир, толще) */}
              {posL && (
                <g>
                  <line x1={M.left} x2={M.left + PLOT_W} y1={yOf(posL.avg)} y2={yOf(posL.avg)} stroke={LONG} strokeWidth={2.5} strokeDasharray="1 5" strokeLinecap="round" opacity={0.9} />
                  <text x={M.left + 4} y={yOf(posL.avg) - 4} fontSize={10} fill={LONG} fontFamily="JetBrains Mono, monospace">
                    поз. Л ×{posL.count}
                  </text>
                </g>
              )}
              {posS && (
                <g>
                  <line x1={M.left} x2={M.left + PLOT_W} y1={yOf(posS.avg)} y2={yOf(posS.avg)} stroke={SHORT} strokeWidth={2.5} strokeDasharray="1 5" strokeLinecap="round" opacity={0.9} />
                  <text x={M.left + 4} y={yOf(posS.avg) - 4} fontSize={10} fill={SHORT} fontFamily="JetBrains Mono, monospace">
                    поз. Ш ×{posS.count}
                  </text>
                </g>
              )}

              {/* пунктиры ждущих входов */}
              {pendingL != null && (
                <g>
                  <line x1={M.left} x2={M.left + PLOT_W} y1={yOf(pendingL)} y2={yOf(pendingL)} stroke={LONG} strokeWidth={1} strokeDasharray="5 4" opacity={0.85} />
                  <text x={M.left + PLOT_W - 4} y={yOf(pendingL) - 4} textAnchor="end" fontSize={10} fill={LONG} fontFamily="JetBrains Mono, monospace">
                    Л {fmtPrice(pendingL)}
                  </text>
                </g>
              )}
              {pendingS != null && (
                <g>
                  <line x1={M.left} x2={M.left + PLOT_W} y1={yOf(pendingS)} y2={yOf(pendingS)} stroke={SHORT} strokeWidth={1} strokeDasharray="5 4" opacity={0.85} />
                  <text x={M.left + PLOT_W - 4} y={yOf(pendingS) + 12} textAnchor="end" fontSize={10} fill={SHORT} fontFamily="JetBrains Mono, monospace">
                    Ш {fmtPrice(pendingS)}
                  </text>
                </g>
              )}

              {/* линия текущей цены + пилюля */}
              {hasPrice && range && (
                <g>
                  <line x1={M.left} x2={M.left + PLOT_W} y1={yOf(price)} y2={yOf(price)} stroke={ACCENT} strokeWidth={1} opacity={0.9} />
                  <rect x={M.left + PLOT_W + 2} y={yOf(price) - 8} width={M.right - 6} height={16} rx={4} fill={ACCENT} />
                  <text x={M.left + PLOT_W + M.right / 2 - 1} y={yOf(price) + 3.5} textAnchor="middle" fontSize={10} fontWeight={600} fill="#0B0E14" fontFamily="JetBrains Mono, monospace">
                    {fmtPrice(price)}
                  </text>
                </g>
              )}

              {/* кроссхейр */}
              {cross && crossBar && (
                <g pointerEvents="none">
                  <line x1={cross.x} x2={cross.x} y1={M.top} y2={M.top + PLOT_H} stroke={FAINT} strokeWidth={1} strokeDasharray="3 3" />
                  <line x1={M.left} x2={M.left + PLOT_W} y1={cross.y} y2={cross.y} stroke={FAINT} strokeWidth={1} strokeDasharray="3 3" />
                  <g opacity={1}>
                    <rect x={tooltipX} y={tooltipY} width={tooltipW} height={112} rx={6} fill="#0D1017" stroke="#232A38" strokeWidth={1} />
                    <text x={tooltipX + 8} y={tooltipY + 16} fontSize={11} fill="#8B93A7" fontFamily="JetBrains Mono, monospace">
                      {fmtTime(crossBar.t, tf)}
                    </text>
                    {(
                      [
                        ['O', crossBar.o],
                        ['H', crossBar.h],
                        ['L', crossBar.l],
                        ['C', crossBar.c],
                      ] as const
                    ).map(([lab, v], i) => (
                      <text
                        key={lab}
                        x={tooltipX + 8 + (i % 2) * 82}
                        y={tooltipY + 34 + Math.floor(i / 2) * 16}
                        fontSize={11}
                        fill={crossUp ? LONG : SHORT}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {lab} {fmtPrice(v)}
                      </text>
                    ))}
                    <text x={tooltipX + 8} y={tooltipY + 78} fontSize={11} fill={FAINT} fontFamily="JetBrains Mono, monospace">
                      объём {crossBar.v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                    </text>
                    <text x={tooltipX + 8} y={tooltipY + 96} fontSize={11} fill={crossUp ? LONG : SHORT} fontFamily="JetBrains Mono, monospace">
                      {crossUp ? '▲' : '▼'} {(((crossBar.c - crossBar.o) / crossBar.o) * 100).toFixed(2).replace('.', ',')}%
                    </text>
                  </g>
                </g>
              )}
            </svg>
          </motion.div>
        </div>
      )}
    </div>
  );
}
