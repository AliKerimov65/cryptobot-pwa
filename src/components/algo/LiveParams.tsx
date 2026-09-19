import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { useEngine } from '@/engine/EngineContext';
import { atr, lastVal } from '@/lib/indicators';
import { cn } from '@/lib/utils';

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Число с флэш-подсветкой фона при изменении (350ms, по знаку изменения). */
function FlashNum({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevRef = useRef(value);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (value === prev || !Number.isFinite(value) || !Number.isFinite(prev)) return;
    setFlash(value > prev ? 'up' : 'down');
    const t = setTimeout(() => setFlash(null), 380);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span
      className={cn(
        'rounded px-0.5 font-mono text-[13px] font-medium',
        flash === 'up' && 'flash-up',
        flash === 'down' && 'flash-down',
        className,
      )}
    >
      {format(value)}
    </span>
  );
}

/** Обратный отсчёт до закрытия текущей 15-минутной свечи (момент пересчёта шага). */
function useCountdown15m(): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.ceil(now / 900_000) * 900_000 - now;
  const mm = Math.floor(left / 60_000);
  const ss = Math.floor((left % 60_000) / 1000);
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function Card({
  label,
  children,
  sub,
  index,
}: {
  label: string;
  children: React.ReactNode;
  sub?: React.ReactNode;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ delay: index * 0.05, duration: 0.2, ease: 'easeOut' }}
      className="flex min-w-0 flex-col gap-1 rounded-xl border border-subtle bg-[#141824] p-3"
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
      {sub != null && <span className="text-[10.5px] leading-snug text-faint">{sub}</span>}
    </motion.div>
  );
}

/** Сетка живых параметров движка: stepG, ATR, плечо, маржа, R190, стороны, пересчёт. */
export default function LiveParams() {
  const eng = useEngine();
  const countdown = useCountdown15m();

  const atrInfo = useMemo(() => {
    if (eng.candles15m.length < 16) return { abs: NaN, pct: NaN };
    const a = lastVal(atr(eng.candles15m, 14));
    const price = Number.isFinite(eng.price) ? eng.price : eng.candles15m[eng.candles15m.length - 1]?.c ?? NaN;
    return { abs: a, pct: Number.isFinite(a) && price > 0 ? (a / price) * 100 : NaN };
  }, [eng.candles15m, eng.price]);

  const margin = eng.equity * eng.legEquityPct;
  const notional = Math.max(margin * eng.leverage, 5);
  const r190 = eng.trendDir !== 0;
  const adxOk = Number.isFinite(eng.adx);

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Card label="Шаг stepG текущий" index={0} sub="коридор clamp 0.15%…2%">
        <FlashNum value={eng.stepG * 100} format={(v) => `${v.toFixed(2)}%`} className="text-brand" />
      </Card>

      <Card
        label="ATR(14, 15м)"
        index={1}
        sub={Number.isFinite(atrInfo.abs) ? `≈ ${fmt(atrInfo.abs, 1)} USDT` : 'накапливаем свечи…'}
      >
        <FlashNum
          value={atrInfo.pct}
          format={(v) => (Number.isFinite(v) ? `${v.toFixed(3)}%` : '—')}
        />
      </Card>

      <Card label="Плечо" index={2} sub="влияет на маржу и номинал ноги">
        <span className="font-mono text-[13px] font-medium text-primary2">{eng.leverage}x</span>
        <Link
          to="/settings"
          className="cursor-pointer rounded-full border border-brand/40 bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-brand hover:bg-brand/20"
        >
          изменить
        </Link>
      </Card>

      <Card
        label="Маржа ноги"
        index={3}
        sub={`${(eng.legEquityPct * 100).toFixed(1)}% × эквити × ${eng.leverage}x → номинал ${fmt(notional, 1)} USDT`}
      >
        <FlashNum value={margin} format={(v) => `${fmt(v)} USDT`} />
      </Card>

      <Card label="Статус R190" index={4} sub="ADX>25 + DI с гистерезисом (выход ADX<20)">
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
            r190 ? 'border-up/40 bg-up/10 text-up' : 'border-subtle bg-cardbg text-muted2',
          )}
        >
          {r190 ? 'активна' : 'неактивна'}
        </span>
      </Card>

      <Card
        label="ADX(14, 1ч)"
        index={5}
        sub={
          adxOk
            ? `+DI ${eng.pdi.toFixed(1)} · −DI ${eng.ndi.toFixed(1)} · режим: ${
                eng.trendDir === 1 ? 'ЛОНГ' : eng.trendDir === -1 ? 'ШОРТ' : 'двусторонний'
              }`
            : 'нужно ≥30 часовых свечей'
        }
      >
        <FlashNum value={eng.adx} format={(v) => (Number.isFinite(v) ? v.toFixed(1) : '—')} />
      </Card>

      <Card label="Вооружённые стороны" index={6} sub="перехватчики от якоря">
        <span className="flex items-center gap-1">
          <span className={cn('h-2 w-2 rounded-full', eng.pendingL != null ? 'bg-up' : 'bg-faint/50')} />
          <span className={cn('text-[11px] font-medium', eng.pendingL != null ? 'text-up' : 'text-faint')}>
            ЛОНГ {eng.pendingL != null ? 'вооружён' : 'ожидание'}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <span className={cn('h-2 w-2 rounded-full', eng.pendingS != null ? 'bg-down' : 'bg-faint/50')} />
          <span className={cn('text-[11px] font-medium', eng.pendingS != null ? 'text-down' : 'text-faint')}>
            ШОРТ {eng.pendingS != null ? 'вооружён' : 'ожидание'}
          </span>
        </span>
      </Card>

      <Card label="Следующий пересчёт шага" index={7} sub="до закрытия 15м свечи (ATR 15м)">
        <span className="font-mono text-[13px] font-medium text-primary2">{countdown}</span>
      </Card>
    </div>
  );
}
