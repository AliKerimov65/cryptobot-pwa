import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Panel from '@/components/Panel';
import { useEngine } from '@/engine/EngineContext';
import { cn } from '@/lib/utils';

const SPARK_W = 40;
const SPARK_H = 16;
const MAX_POINTS = 40;

function fmtPrice(n: number): string {
  const digits = n >= 1000 ? 1 : n >= 1 ? 2 : 4;
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function MiniSpark({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) {
    return <span className="inline-block h-4 w-10 rounded-sm bg-gridline/60" aria-hidden />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = SPARK_W / (points.length - 1);
  const line = points
    .map((p, i) => {
      const x = i * stepX;
      const y = 1 + (SPARK_H - 2) - ((p - min) / span) * (SPARK_H - 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      role="img"
      aria-label="Мини-спарк изменения цены"
    >
      <path
        d={line}
        fill="none"
        stroke={up ? '#34D399' : '#F87171'}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Таблица наблюдаемых символов: цена, мини-спарк, перевод в активный символ. */
export default function SymbolsTable() {
  const eng = useEngine();
  const historyRef = useRef<Record<string, number[]>>({});
  const [, setVersion] = useState(0);

  // Накопление истории тиков по каждому символу
  useEffect(() => {
    let changed = false;
    for (const sym of eng.symbols) {
      const p = eng.prices[sym];
      if (!Number.isFinite(p)) continue;
      const arr = (historyRef.current[sym] ??= []);
      if (arr[arr.length - 1] !== p) {
        arr.push(p);
        if (arr.length > MAX_POINTS) arr.shift();
        changed = true;
      }
    }
    if (changed) setVersion((v) => v + 1);
  }, [eng.prices, eng.symbols]);

  // 24ч % считается из часовых свечей — они есть только для активного символа
  const activeDayPct = useMemo(() => {
    const cs = eng.candles1h;
    if (cs.length < 2) return null;
    const base = cs.slice(-24)[0].c;
    const last = cs[cs.length - 1].c;
    return base > 0 ? ((last - base) / base) * 100 : null;
  }, [eng.candles1h]);

  return (
    <Panel title="Наблюдение">
      <ul className="divide-y divide-[#1A2030]">
        {eng.symbols.map((sym, i) => {
          const price = eng.prices[sym];
          const hasPrice = Number.isFinite(price);
          const isActive = sym === eng.symbol;
          const hist = historyRef.current[sym] ?? [];
          const up = hist.length >= 2 ? hist[hist.length - 1] >= hist[0] : true;
          const pct = isActive ? activeDayPct : null;
          return (
            <motion.li
              key={sym}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05, ease: 'easeOut' }}
              className="flex items-center gap-3 py-2.5 transition-colors hover:bg-cardhover/60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 font-mono text-[12px] font-semibold text-brand">
                {sym[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[13px] font-medium text-primary2">{sym}</p>
                <p className="font-mono text-[11px] text-faint">
                  {pct != null
                    ? `24ч ${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`
                    : '24ч % — только для активного'}
                </p>
              </div>
              <MiniSpark points={hist} up={up} />
              <motion.span
                key={hasPrice ? price : 'na'}
                className={cn(
                  'w-24 shrink-0 rounded-md px-1 text-right font-mono text-[13px] font-medium',
                  hasPrice ? 'text-primary2' : 'text-faint',
                )}
              >
                {hasPrice ? fmtPrice(price) : '—'}
              </motion.span>
              {isActive ? (
                <span className="shrink-0 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-brand">
                  активный
                </span>
              ) : (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => eng.actions.setSymbol(sym)}
                  className="shrink-0 cursor-pointer rounded-lg border border-subtle px-2 py-1 text-[11px] font-medium text-muted2 transition-colors hover:text-primary2"
                >
                  Сделать активным
                </motion.button>
              )}
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-snug text-faint">
        Добавление произвольных символов — в дорожной карте (v1.1+). Смена активного символа
        переключает конвейер и подписки kline.
      </p>
    </Panel>
  );
}
