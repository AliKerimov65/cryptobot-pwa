import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatePresence, motion, useSpring, useTransform } from 'framer-motion';
import { ChevronDown, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { useEngine } from '@/engine/EngineContext';
import Panel from '@/components/Panel';
import MetricChip from '@/components/MetricChip';
import StatusBanner from '@/components/StatusBanner';
import JournalFeed from '@/components/JournalFeed';
import Sparkline from '@/components/Sparkline';
import OfflineScreen from '@/components/OfflineScreen';
import { ema, lastVal, rsi } from '@/lib/indicators';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

function fmtUsd(n: number, digits = 2): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtSigned(n: number, digits = 2): string {
  const s = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${s}${fmtUsd(Math.abs(n), digits)}`;
}

export default function Home() {
  const eng = useEngine();
  const navigate = useNavigate();
  const [journalOpen, setJournalOpen] = useState(true);

  // Count-up эквити при монтировании и тиках
  const equitySpring = useSpring(eng.equity, { duration: 600, bounce: 0 });
  useEffect(() => {
    equitySpring.set(eng.equity);
  }, [eng.equity, equitySpring]);
  const equityText = useTransform(equitySpring, (v) => fmtUsd(v));

  // Контекст рынка: EMA200(1ч), RSI(14, 15м)
  const market = useMemo(() => {
    const closes1h = eng.candles1h.map((c) => c.c);
    const closes15 = eng.candles15m.map((c) => c.c);
    const ema200 = closes1h.length >= 200 ? lastVal(ema(closes1h, 200)) : NaN;
    const rsi15 = closes15.length >= 15 ? lastVal(rsi(closes15, 14)) : NaN;
    return { ema200, rsi15 };
  }, [eng.candles1h, eng.candles15m]);

  const dayBase = eng.equity - eng.dayRealized;
  const dayPct = dayBase > 0 ? (eng.dayRealized / dayBase) * 100 : 0;
  const trendActive = eng.trendDir !== 0;
  const hasData = eng.candles1m.length > 0 || Number.isFinite(eng.price);

  if (!eng.online && !hasData) {
    return <OfflineScreen onRetry={() => eng.actions.retryRest()} />;
  }

  return (
    <div className="space-y-3">
      {/* 1. Баннеры состояния */}
      <AnimatePresence>
        {!eng.restAvailable && (
          <StatusBanner
            key="rest"
            variant="warn"
            text="История свечей недоступна из вашей сети — накапливаем онлайн через WebSocket"
            actionLabel="Повторить"
            onAction={() => eng.actions.retryRest()}
          />
        )}
        {eng.wsStatus === 'offline' && (
          <StatusBanner
            key="ws-off"
            variant="short"
            text="Соединение с Bybit разорвано — живая лента остановлена"
            actionLabel="Повторить"
            onAction={() => window.location.reload()}
          />
        )}
        {eng.wsStatus === 'reconnecting' && (
          <StatusBanner
            key="ws-re"
            variant="neutral"
            text="Переподключаемся к Bybit WebSocket…"
          />
        )}
      </AnimatePresence>

      {/* 2. Hero: Эквити конвейера */}
      <motion.div {...fadeUp}>
        <Panel
          className="border-brand/10 bg-gradient-to-b from-[#12161F] to-[#171B24]"
          title={
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
              Эквити paper-порта · USDT
            </span>
          }
          actions={
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]',
                eng.running
                  ? 'border-up/40 bg-up/10 text-up'
                  : 'border-warn/40 bg-warn/10 text-warn',
              )}
            >
              {eng.running ? 'работает' : 'пауза'}
            </span>
          }
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <motion.span className="font-mono text-[30px] font-bold leading-none text-primary2">
                {equityText}
              </motion.span>
              <span
                className={cn(
                  'flex items-center gap-1 font-mono text-[14px] font-semibold',
                  dayPct >= 0 ? 'text-up' : 'text-down',
                )}
              >
                {dayPct >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                {fmtSigned(dayPct)}%
              </span>
            </div>
            <Sparkline points={eng.equityCurve} width={120} height={40} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricChip
              label="Реализ. сутки (UTC)"
              value={`${fmtSigned(eng.dayRealized)} USDT`}
              variant={eng.dayRealized >= 0 ? 'long' : 'short'}
            />
            <MetricChip
              label="Плавающий нетто"
              value={`${fmtSigned(eng.floatingNet)} USDT`}
              variant={eng.floatingNet >= 0 ? 'long' : 'short'}
            />
            <MetricChip
              label="Сделок / WR"
              value={`${eng.trades} / ${eng.wr.toFixed(0)}%`}
              variant="neutral"
            />
            <MetricChip
              label="MaxDD / пик эквити"
              value={`${(eng.maxDD * 100).toFixed(1)}% / ${fmtUsd(eng.peakEquity, 0)}`}
              variant={eng.maxDD > 0.05 ? 'warn' : 'neutral'}
            />
          </div>
        </Panel>
      </motion.div>

      {/* 3. Режим рынка + гейт R190 */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }}>
        <Panel title="Режим рынка">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-x-1.5 text-[14px]">
                <span className="text-muted2">Тренд:</span>
                <span
                  className={cn(
                    'font-mono font-semibold',
                    Number.isFinite(eng.adx) && eng.adx > 25 ? 'text-brand' : 'text-muted2',
                  )}
                >
                  ADX 1ч {Number.isFinite(eng.adx) ? eng.adx.toFixed(0) : '—'}
                </span>
                <span className="font-mono text-muted2">
                  {eng.trendDir > 0 ? '↑' : eng.trendDir < 0 ? '↓' : '·'}
                </span>
                <span className="font-mono text-[12px] text-faint">
                  DI+ {Number.isFinite(eng.pdi) ? eng.pdi.toFixed(0) : '—'} / DI−{' '}
                  {Number.isFinite(eng.ndi) ? eng.ndi.toFixed(0) : '—'}
                </span>
              </p>
              <p className="mt-1 text-[12px] text-faint">
                {!Number.isFinite(market.ema200)
                  ? 'EMA200(1ч) — накапливаем историю'
                  : `EMA200(1ч) ${market.ema200 > (eng.price || 0) ? 'выше' : 'ниже'} цены`}
                {' · '}
                RSI(15м) {Number.isFinite(market.rsi15) ? market.rsi15.toFixed(0) : '—'}
                {' · '}
                шаг {(eng.stepG * 100).toFixed(2)}%
                {eng.anchor != null && ` · якорь ${fmtUsd(eng.anchor, 1)}`}
              </p>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={trendActive ? 'asym' : 'dual'}
                initial={{ rotateX: 90, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                exit={{ rotateX: -90, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  'relative shrink-0 overflow-hidden rounded-full border px-3 py-1.5 text-[11px] font-medium',
                  trendActive
                    ? 'border-warn/50 text-warn'
                    : 'border-subtle text-muted2',
                )}
              >
                {trendActive && <span className="gate-pulse absolute inset-0 bg-warn" />}
                <span className="relative">
                  R190 · {trendActive ? 'асимметрия: контр-тренд не вооружён' : 'двусторонний режим'}
                </span>
              </motion.span>
            </AnimatePresence>
          </div>
        </Panel>
      </motion.div>

      {/* 4. Активные боты (превью) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-primary2">
            Боты в работе
          </h2>
          <Link to="/bots" className="text-[12px] font-medium text-brand hover:underline">
            Все боты →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {eng.symbols.map((sym, i) => {
            const active = sym === eng.symbol;
            const price = eng.prices[sym];
            return (
              <motion.button
                key={sym}
                type="button"
                onClick={() => navigate('/bots')}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.07 }}
                whileHover={{ y: -2 }}
                className="cursor-pointer rounded-2xl border border-subtle bg-cardbg p-3.5 text-left transition-colors duration-150 hover:bg-cardhover"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      active && eng.running
                        ? 'bg-up'
                        : active
                          ? 'bg-warn'
                          : 'bg-faint',
                    )}
                  />
                  <span className="text-[13px] font-semibold text-primary2">
                    {sym} <span className="font-normal text-faint">· перехватчик</span>
                  </span>
                  <span className="ml-auto font-mono text-[12px] text-muted2">
                    {Number.isFinite(price) ? fmtUsd(price, 1) : '—'}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[12px] text-muted2">
                  {active
                    ? `эквити ${fmtUsd(eng.equity)} USDT · плав. ${fmtSigned(eng.floatingNet)} · сделок ${eng.trades} (WR ${eng.wr.toFixed(0)}%)`
                    : 'пауза · конвейер ведётся на активном символе'}
                </p>
                <div className="mt-2 flex gap-2">
                  <span className="rounded-full bg-up/10 px-2 py-0.5 font-mono text-[11px] text-up">
                    Л {active ? fmtSigned(eng.statsL.realized) : '—'}
                  </span>
                  <span className="rounded-full bg-down/10 px-2 py-0.5 font-mono text-[11px] text-down">
                    Ш {active ? fmtSigned(eng.statsS.realized) : '—'}
                  </span>
                  {active && (eng.pendingL != null || eng.pendingS != null) && (
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[11px] text-brand">
                      входы вооружены
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* 5. Триада дня */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <Panel>
          <div className="grid grid-cols-3 divide-x divide-[#1A2030]">
            <div className="px-3 first:pl-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
                Плавающий нетто
              </p>
              <p
                className={cn(
                  'mt-1 font-mono text-[20px] font-semibold leading-none',
                  eng.floatingNet >= 0 ? 'text-up' : 'text-down',
                )}
              >
                {fmtSigned(eng.floatingNet)}
              </p>
            </div>
            <div className="px-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
                Реализовано (UTC)
              </p>
              <p
                className={cn(
                  'mt-1 font-mono text-[20px] font-semibold leading-none',
                  eng.dayRealized >= 0 ? 'text-up' : 'text-down',
                )}
              >
                {fmtSigned(eng.dayRealized)}
              </p>
            </div>
            <div className="px-3 last:pr-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
                Сделок / WR%
              </p>
              <p className="mt-1 font-mono text-[20px] font-semibold leading-none text-primary2">
                {eng.trades} <span className="text-[13px] text-muted2">/ {eng.wr.toFixed(0)}%</span>
              </p>
              <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-subtle">
                <motion.div
                  className="h-full rounded-full bg-up"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.min(eng.wr, 100)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </Panel>
      </motion.div>

      {/* 6. Журнал (компактный) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <Panel
          title="Журнал"
          actions={
            <button
              type="button"
              onClick={() => setJournalOpen((v) => !v)}
              className="flex cursor-pointer items-center gap-1 text-[12px] font-medium text-muted2 transition-colors hover:text-primary2"
            >
              {journalOpen ? 'Свернуть' : 'Развернуть'}
              <motion.span animate={{ rotate: journalOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={14} />
              </motion.span>
            </button>
          }
        >
          <AnimatePresence initial={false}>
            {journalOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <JournalFeed entries={eng.journal} limit={8} />
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>
      </motion.div>

      {/* 7. Инфо-блок «Зеркало v1» */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.3 }}
        className="flex items-start gap-2.5 rounded-xl border border-dashed border-subtle px-3.5 py-3"
      >
        <Info size={15} className="mt-0.5 shrink-0 text-faint" />
        <p className="text-[12px] leading-relaxed text-muted2">
          PWA-зеркало paper-конвейера. Синхронизация с Android-приложением — v2 · Совет сонара и
          вето P(BE≤72ч) — v1.1+ · Живая торговля из браузера — v2
        </p>
      </motion.div>
    </div>
  );
}
