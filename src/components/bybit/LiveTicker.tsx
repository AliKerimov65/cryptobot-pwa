import { useEffect, useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import Panel from '@/components/Panel';
import { useEngine } from '@/engine/EngineContext';
import { cn } from '@/lib/utils';

function fmtPrice(n: number): string {
  const digits = n >= 1000 ? 1 : n >= 1 ? 2 : 4;
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtTurnover(usdt: number): string {
  if (usdt >= 1e9) return `${(usdt / 1e9).toFixed(2)} млрд`;
  if (usdt >= 1e6) return `${(usdt / 1e6).toFixed(1)} млн`;
  return usdt.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

interface TickSnap {
  symbol: string;
  price: number;
  ticks: number[];
  dir: -1 | 0 | 1;
}

/** Живой тикер активного символа: цена 32px, чипы 24ч, спарклайн последних 60 тиков. */
export default function LiveTicker() {
  const eng = useEngine();
  const gid = useId().replace(/[:]/g, '');

  // История тиков и направление — корректировка состояния при изменении цены (рендер-фаза)
  const [snap, setSnap] = useState<TickSnap>(() => ({
    symbol: eng.symbol,
    price: eng.price,
    ticks: Number.isFinite(eng.price) ? [eng.price] : [],
    dir: 0,
  }));

  if (eng.symbol !== snap.symbol) {
    setSnap({
      symbol: eng.symbol,
      price: eng.price,
      ticks: Number.isFinite(eng.price) ? [eng.price] : [],
      dir: 0,
    });
  } else if (Number.isFinite(eng.price) && eng.price !== snap.price) {
    setSnap({
      symbol: snap.symbol,
      price: eng.price,
      ticks: [...snap.ticks, eng.price].slice(-60),
      dir: Number.isFinite(snap.price) ? (eng.price > snap.price ? 1 : -1) : 0,
    });
  }

  // Гашение микро-стрелки через 400 мс после последнего изменения
  useEffect(() => {
    if (snap.dir === 0) return;
    const id = window.setTimeout(() => setSnap((s) => ({ ...s, dir: 0 })), 400);
    return () => window.clearTimeout(id);
  }, [snap.dir, snap.price]);

  // 24ч статистика из часовых свечей активного символа (если история доступна)
  const day = useMemo(() => {
    const cs = eng.candles1h;
    if (cs.length < 2) return null;
    const last = cs[cs.length - 1];
    const window24 = cs.slice(-24);
    const base = window24[0].c;
    const changePct = base > 0 ? ((last.c - base) / base) * 100 : 0;
    const turnover = window24.reduce((sum, c) => sum + c.v * c.c, 0);
    return { changePct, turnover };
  }, [eng.candles1h]);

  // Спарклайн 60 тиков
  const spark = useMemo(() => {
    const pts = snap.ticks;
    if (pts.length < 2) return null;
    const w = 260;
    const h = 56;
    const pad = 3;
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || 1;
    const stepX = (w - pad * 2) / (pts.length - 1);
    const coords = pts.map((p, i) => [
      pad + i * stepX,
      pad + (h - pad * 2) - ((p - min) / span) * (h - pad * 2),
    ]);
    const line = coords
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(' ');
    return { line, last: coords[coords.length - 1], w, h };
  }, [snap.ticks]);

  const hasPrice = Number.isFinite(eng.price);
  const dayUp = (day?.changePct ?? 0) >= 0;
  const sparkColor = dayUp ? '#34D399' : '#F87171';
  const dir = snap.symbol === eng.symbol ? snap.dir : 0;

  return (
    <Panel title={eng.symbol}>
      {!hasPrice ? (
        <div className="space-y-2.5" aria-hidden>
          <div className="skeleton-shimmer h-8 w-48 rounded-md" />
          <div className="skeleton-shimmer h-3.5 w-64 rounded-md" />
          <p className="text-[11px] text-faint">Ждём первый тик от Bybit WebSocket…</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <motion.span
                key={eng.price}
                className={cn(
                  'rounded-md px-1 font-mono text-[32px] font-bold leading-none text-primary2',
                  dir === 1 && 'flash-up',
                  dir === -1 && 'flash-down',
                )}
              >
                {fmtPrice(eng.price)}
              </motion.span>
              {dir !== 0 && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={dir === 1 ? 'text-up' : 'text-down'}
                >
                  {dir === 1 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                </motion.span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 font-mono text-[11px]',
                  day
                    ? dayUp
                      ? 'border-up/40 bg-up/10 text-up'
                      : 'border-down/40 bg-down/10 text-down'
                    : 'border-subtle text-faint',
                )}
              >
                24ч {day ? `${dayUp ? '+' : '−'}${Math.abs(day.changePct).toFixed(2)}%` : '—'}
              </span>
              <span className="rounded-full border border-subtle px-2 py-0.5 font-mono text-[11px] text-muted2">
                24ч оборот {day ? `≈ ${fmtTurnover(day.turnover)} USDT` : '—'}
              </span>
              {!day && (
                <span className="rounded-full border border-subtle px-2 py-0.5 text-[11px] text-faint">
                  статистика 24ч появится из часовых свечей
                </span>
              )}
            </div>
          </div>

          {spark && (
            <svg
              viewBox={`0 0 ${spark.w} ${spark.h}`}
              width={spark.w}
              height={spark.h}
              className="shrink-0"
              role="img"
              aria-label="Спарклайн последних тиков"
            >
              <defs>
                <linearGradient id={`tick-${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path
                d={`${spark.line} L${spark.last[0].toFixed(1)} ${spark.h} L3 ${spark.h} Z`}
                fill={`url(#tick-${gid})`}
              />
              <path
                d={spark.line}
                fill="none"
                stroke={sparkColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx={spark.last[0]} cy={spark.last[1]} r="3" fill={sparkColor}>
                <animate attributeName="r" values="3;4.2;3" dur="1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.55;1" dur="1s" repeatCount="indefinite" />
              </circle>
            </svg>
          )}
        </div>
      )}
    </Panel>
  );
}
