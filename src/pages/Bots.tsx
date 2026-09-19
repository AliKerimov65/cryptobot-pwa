import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Pause, Play, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { useEngine } from '@/engine/EngineContext';
import { ADX_ENTER } from '@/engine/conveyor';
import { adx, atr, ema, lastVal, rsi } from '@/lib/indicators';
import { cn } from '@/lib/utils';
import Panel from '@/components/Panel';
import MetricChip from '@/components/MetricChip';
import SidePanel from '@/components/SidePanel';
import StatusBanner from '@/components/StatusBanner';
import JournalFeed from '@/components/JournalFeed';
import OfflineScreen from '@/components/OfflineScreen';
import CandleChart from '@/components/bots/CandleChart';
import FlashNumber from '@/components/bots/FlashNumber';
import RescuerEcho from '@/components/bots/RescuerEcho';
import ConfirmResetModal from '@/components/bots/ConfirmResetModal';
import { useDerivedLegs } from '@/components/bots/useDerivedLegs';
import { fmtPct, fmtPrice, fmtSigned, fmtUsd } from '@/components/bots/format';

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18, ease: 'easeOut' as const },
};

export default function Bots() {
  const eng = useEngine();
  const [collapsed, setCollapsed] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [journalFull, setJournalFull] = useState(false);

  const derived = useDerivedLegs(eng.journal, eng.price);

  /* ---------- контекст рынка (мониторинг §5.8) ---------- */
  const market = useMemo(() => {
    const closes1h = eng.candles1h.map((c) => c.c);
    const closes30 = eng.candles['30'].map((c) => c.c);
    const ema200 = closes1h.length >= 200 ? lastVal(ema(closes1h, 200)) : NaN;
    const rsi30 = closes30.length >= 15 ? lastVal(rsi(closes30, 14)) : NaN;
    const adx30 = lastVal(adx(eng.candles['30'], 14).adx);
    // перцентиль текущего ATR(14, 15м) по собственной истории
    const atrArr = atr(eng.candles15m, 14).filter((v) => Number.isFinite(v));
    const atrNow = atrArr.length ? atrArr[atrArr.length - 1] : NaN;
    const atrPct =
      atrArr.length > 10 && Number.isFinite(atrNow)
        ? Math.round((atrArr.filter((v) => v <= atrNow).length / atrArr.length) * 100)
        : NaN;
    const atrFrac = Number.isFinite(atrNow) && Number.isFinite(eng.price) && eng.price > 0
      ? atrNow / eng.price
      : NaN;
    // доля флэта/тренда по истории ADX(1ч)
    const adx1hArr = adx(eng.candles1h, 14).adx.filter((v) => Number.isFinite(v));
    const trendShare = adx1hArr.length
      ? Math.round((adx1hArr.filter((v) => v > ADX_ENTER).length / adx1hArr.length) * 100)
      : NaN;
    return { ema200, rsi30, adx30, atrNow, atrPct, atrFrac, trendShare };
  }, [eng.candles1h, eng.candles, eng.candles15m, eng.price]);

  const trendActive = eng.trendDir !== 0;
  const realizedTotal = eng.statsL.realized + eng.statsS.realized;
  const hasData = eng.candles1m.length > 0 || Number.isFinite(eng.price);

  const pendingCount = (eng.pendingL != null ? 1 : 0) + (eng.pendingS != null ? 1 : 0);

  const sideEntries = (side: 'L' | 'S') => {
    const pending = side === 'L' ? eng.pendingL : eng.pendingS;
    const agg = side === 'L' ? derived.long : derived.short;
    if (pending != null) {
      const tp = side === 'L' ? pending * (1 + eng.stepG) : pending * (1 - eng.stepG);
      return `${fmtPrice(pending)} → ${fmtPrice(tp)}`;
    }
    if (agg.count > 0 && Number.isFinite(agg.avgEntry)) {
      const tp = side === 'L' ? agg.avgEntry * (1 + eng.stepG) : agg.avgEntry * (1 - eng.stepG);
      return `${fmtPrice(agg.avgEntry)} → ${fmtPrice(tp)}`;
    }
    return '—';
  };

  if (!eng.online && !hasData) {
    return <OfflineScreen onRetry={() => eng.actions.retryRest()} />;
  }

  return (
    <div className="space-y-3">
      {/* Баннеры состояния */}
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
          <StatusBanner key="ws-re" variant="neutral" text="Переподключаемся к Bybit WebSocket…" />
        )}
      </AnimatePresence>

      {/* Панель управления списком */}
      <motion.div {...fadeUp} className="flex flex-wrap items-center gap-2">
        <h1 className="text-[24px] font-bold tracking-[-0.01em] text-primary2">Боты</h1>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]',
            eng.running
              ? 'border-up/40 bg-up/10 text-up'
              : 'border-warn/40 bg-warn/10 text-warn',
          )}
        >
          {eng.running ? '1 активный' : 'на паузе'}
        </span>
        <div className="flex-1" />
        {/* Выбор символа paper-бота */}
        <div className="flex items-center gap-1">
          {eng.symbols.map((s) => {
            const active = s === eng.symbol;
            const p = eng.prices[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => eng.actions.setSymbol(s)}
                className={cn(
                  'relative cursor-pointer rounded-full px-3 py-1.5 font-mono text-[11px] transition-colors',
                  active
                    ? 'text-brand'
                    : 'border border-subtle text-muted2 hover:text-primary2',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="bots-symbol-pill"
                    className="absolute inset-0 rounded-full border border-brand/40 bg-brand/15"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative">
                  {s.replace('USDT', '')}
                  {Number.isFinite(p) && (
                    <span className="ml-1 text-[10px] opacity-70">{fmtPrice(p)}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ============ Карточка бота (реплика Android-приложения) ============ */}
      <motion.section
        {...fadeUp}
        className="rounded-2xl border border-subtle bg-gradient-to-b from-[#10131A] to-[#171B24] p-4"
      >
        {/* 2.1 Шапка карточки */}
        <header className="flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              eng.running ? 'bg-up ws-pulse' : 'bg-faint',
            )}
            title={eng.running ? 'Бот работает' : 'Бот на паузе'}
          />
          <h2 className="text-[16px] font-semibold text-primary2">
            {eng.symbol} · перехватчик
          </h2>
          <div className="flex-1" />
          <FlashNumber
            value={eng.equity}
            format={(n) => `${fmtUsd(n)} USDT`}
            className="text-[15px] font-semibold text-primary2"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => (eng.running ? eng.actions.stop() : eng.actions.start())}
              title={eng.running ? 'Пауза' : 'Старт'}
              aria-label={eng.running ? 'Пауза' : 'Старт'}
              className={cn(
                'cursor-pointer rounded-lg border p-2 transition-colors',
                eng.running
                  ? 'border-warn/40 text-warn hover:bg-warn/10'
                  : 'border-up/40 text-up hover:bg-up/10',
              )}
            >
              {eng.running ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              title="Сброс paper-состояния"
              aria-label="Сброс paper-состояния"
              className="cursor-pointer rounded-lg border border-down/40 p-2 text-down transition-colors hover:bg-down/10"
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Развернуть карточку' : 'Свернуть карточку'}
              aria-label={collapsed ? 'Развернуть карточку' : 'Свернуть карточку'}
              className="cursor-pointer rounded-lg border border-subtle p-2 text-muted2 transition-colors hover:text-primary2"
            >
              <motion.span
                animate={{ rotate: collapsed ? 180 : 0 }}
                transition={{ duration: 0.26, ease: 'easeInOut' }}
                className="block"
              >
                <ChevronDown size={15} />
              </motion.span>
            </button>
          </div>
        </header>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="bot-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.26, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-3">
                {/* 2.2 Строка тренда и режимные гейты */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span className="font-mono text-[12.5px] text-muted2">
                    Тренд: ADX 1ч{' '}
                    <span className="text-primary2">
                      {Number.isFinite(eng.adx) ? eng.adx.toFixed(0) : '—'}
                    </span>
                    {' / '}30м{' '}
                    <span className="text-primary2">
                      {Number.isFinite(market.adx30) ? market.adx30.toFixed(0) : '—'}
                    </span>
                  </span>
                  {eng.trendDir === 1 && (
                    <TrendingUp size={14} className="text-up" aria-label="тренд вверх" />
                  )}
                  {eng.trendDir === -1 && (
                    <TrendingDown size={14} className="text-down" aria-label="тренд вниз" />
                  )}
                  {eng.trendDir === 0 && (
                    <span className="font-mono text-[12.5px] text-faint">↔</span>
                  )}
                  <span className="font-mono text-[12.5px] text-muted2">
                    · гейт R180: {trendActive ? 'по тренду' : 'двусторонний'}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                      trendActive
                        ? 'border border-subtle text-muted2'
                        : 'border border-warn/40 bg-warn/10 text-warn',
                    )}
                  >
                    R180
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                      trendActive
                        ? 'border-warn/40 bg-warn/10 text-warn'
                        : 'border-subtle text-muted2',
                    )}
                  >
                    R190
                  </span>
                </div>

                {/* 2.3 Контекст рынка (мониторинг §5.8) */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-6">
                  <MetricChip
                    label="EMA200 (1ч)"
                    value={
                      Number.isFinite(market.ema200)
                        ? `${eng.price >= market.ema200 ? '●' : '○'} ${fmtPrice(market.ema200)}`
                        : '—'
                    }
                    variant={
                      !Number.isFinite(market.ema200)
                        ? 'neutral'
                        : eng.price >= market.ema200
                          ? 'long'
                          : 'short'
                    }
                  />
                  <MetricChip
                    label="RSI (30м)"
                    value={Number.isFinite(market.rsi30) ? market.rsi30.toFixed(0) : '—'}
                    variant={
                      !Number.isFinite(market.rsi30)
                        ? 'neutral'
                        : market.rsi30 >= 70
                          ? 'short'
                          : market.rsi30 <= 30
                            ? 'long'
                            : 'neutral'
                    }
                  />
                  <MetricChip label="пик эквити" value={`${fmtUsd(eng.peakEquity)} ₮`} />
                  <MetricChip
                    label="MaxDD"
                    value={fmtPct(eng.maxDD, 1)}
                    variant={eng.maxDD > 0.05 ? 'short' : eng.maxDD > 0.02 ? 'warn' : 'neutral'}
                  />
                  <MetricChip
                    label="флэт % / тренд %"
                    value={
                      Number.isFinite(market.trendShare)
                        ? `${100 - (market.trendShare as number)} / ${market.trendShare}`
                        : '—'
                    }
                  />
                  <MetricChip
                    label="перцентиль ATR"
                    value={
                      Number.isFinite(market.atrPct) ? `п${market.atrPct}` : '—'
                    }
                    variant="accent"
                  />
                </div>

                {/* 2.4 Параметры конвейера */}
                <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                  {[
                    `якорь ${eng.anchor != null ? fmtPrice(eng.anchor) : '—'}`,
                    `шаг ${fmtPct(eng.stepG)}`,
                    `k ${eng.k}`,
                    `ATR(15м) ${
                      Number.isFinite(market.atrFrac)
                        ? `${fmtPct(market.atrFrac)}${Number.isFinite(market.atrPct) ? ` (п${market.atrPct})` : ''}`
                        : '—'
                    }`,
                    `плечо ${eng.leverage}x`,
                  ].map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-transparent bg-[#1A1F2B] px-2 py-0.5 text-muted2 transition-colors hover:border-brand/50 hover:text-primary2"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                {/* 2.5 Лоты и ордера */}
                <div className="grid grid-cols-1 gap-1.5 text-[12px] sm:grid-cols-3">
                  <div className="text-muted2">
                    Лоты в позиции:{' '}
                    <span className="font-mono text-primary2">
                      Л <span className="text-up">{eng.legsL}</span> / Ш{' '}
                      <span className="text-down">{eng.legsS}</span>
                    </span>
                  </div>
                  <div className="text-muted2">
                    Ждущие входы:{' '}
                    <span className="font-mono text-primary2">
                      {pendingCount}
                      {pendingCount > 0 && ' ('}
                      {eng.pendingL != null && (
                        <span className="text-up">Л {fmtPrice(eng.pendingL)}</span>
                      )}
                      {eng.pendingL != null && eng.pendingS != null && ' / '}
                      {eng.pendingS != null && (
                        <span className="text-down">Ш {fmtPrice(eng.pendingS)}</span>
                      )}
                      {pendingCount > 0 && ')'}
                    </span>
                  </div>
                  <div className="text-muted2">
                    Эквити:{' '}
                    <FlashNumber
                      value={eng.equity}
                      format={(n) => `${fmtUsd(n)} USDT`}
                      className="text-[12px] text-primary2"
                    />
                  </div>
                </div>

                {/* 2.6 Позиция (симуляция) */}
                <div className="rounded-xl bg-[#0E1219] p-3">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
                    Позиция (симуляция конвейера)
                  </p>
                  {(
                    [
                      { side: 'ЛОНГ', agg: derived.long, color: 'text-up' },
                      { side: 'ШОРТ', agg: derived.short, color: 'text-down' },
                    ] as const
                  ).map(({ side, agg, color }) =>
                    agg.count > 0 ? (
                      <div
                        key={side}
                        className="flex flex-wrap items-baseline gap-x-2 py-0.5 font-mono text-[12px]"
                      >
                        <span className={cn('font-semibold', color)}>{side}</span>
                        <span className="text-muted2">· {agg.count} шт ·</span>
                        <span className="text-primary2">ср. {fmtPrice(agg.avgEntry)}</span>
                        <span className="text-muted2">·</span>
                        <span className="text-primary2">номинал {fmtUsd(agg.notional, 1)} USDT</span>
                        <span className="text-muted2">·</span>
                        <span
                          className={cn(
                            'font-medium',
                            agg.floatingGross > 0
                              ? 'text-up'
                              : agg.floatingGross < 0
                                ? 'text-down'
                                : 'text-muted2',
                          )}
                        >
                          плав. брутто {fmtSigned(agg.floatingGross)}
                        </span>
                      </div>
                    ) : (
                      <p key={side} className="py-0.5 font-mono text-[12px] text-faint">
                        {side} · нет открытых лотов
                      </p>
                    ),
                  )}
                </div>

                {/* 2.7 Свечной график */}
                <CandleChart
                  candles={eng.candles}
                  price={eng.price}
                  pendingL={eng.pendingL}
                  pendingS={eng.pendingS}
                  posL={
                    derived.long.count > 0
                      ? { avg: derived.long.avgEntry, count: derived.long.count }
                      : null
                  }
                  posS={
                    derived.short.count > 0
                      ? { avg: derived.short.avgEntry, count: derived.short.count }
                      : null
                  }
                  restAvailable={eng.restAvailable}
                  online={eng.online}
                  symbol={eng.symbol}
                />

                {/* 2.8 Триада */}
                <div className="grid grid-cols-3 gap-3 rounded-xl border border-subtle p-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
                      Плавающий нетто
                    </span>
                    <FlashNumber
                      value={eng.floatingNet}
                      format={(n) => fmtSigned(n)}
                      className={cn(
                        'text-[14px] font-semibold',
                        eng.floatingNet > 0
                          ? 'text-up'
                          : eng.floatingNet < 0
                            ? 'text-down'
                            : 'text-muted2',
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
                      Реализовано
                    </span>
                    <FlashNumber
                      value={realizedTotal}
                      format={(n) => fmtSigned(n)}
                      className={cn(
                        'text-[14px] font-semibold',
                        realizedTotal > 0
                          ? 'text-up'
                          : realizedTotal < 0
                            ? 'text-down'
                            : 'text-muted2',
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
                      Сделок (WR%)
                    </span>
                    <span className="rounded px-1 font-mono text-[14px] font-semibold text-primary2">
                      {eng.trades}{' '}
                      <span className="text-[12px] text-muted2">({eng.wr.toFixed(0)}%)</span>
                    </span>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#1A2030]">
                      <div
                        className="h-full rounded-full bg-brand transition-[width] duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, eng.wr))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2.9 Панели ЛОНГ / ШОРТ */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SidePanel
                    side="L"
                    rows={[
                      {
                        label: 'реализ.',
                        value: fmtSigned(eng.statsL.realized),
                        tone: eng.statsL.realized > 0 ? 'long' : eng.statsL.realized < 0 ? 'short' : 'neutral',
                      },
                      {
                        label: 'сутки',
                        value: fmtSigned(derived.long.dayRealized),
                        tone: derived.long.dayRealized > 0 ? 'long' : derived.long.dayRealized < 0 ? 'short' : 'neutral',
                      },
                      {
                        label: 'плав.',
                        value: derived.long.count > 0 ? fmtSigned(derived.long.floatingGross) : '—',
                        tone: derived.long.floatingGross > 0 ? 'long' : derived.long.floatingGross < 0 ? 'short' : 'neutral',
                      },
                      { label: 'входы → ТР', value: sideEntries('L') },
                    ]}
                  />
                  <SidePanel
                    side="S"
                    rows={[
                      {
                        label: 'реализ.',
                        value: fmtSigned(eng.statsS.realized),
                        tone: eng.statsS.realized > 0 ? 'long' : eng.statsS.realized < 0 ? 'short' : 'neutral',
                      },
                      {
                        label: 'сутки',
                        value: fmtSigned(derived.short.dayRealized),
                        tone: derived.short.dayRealized > 0 ? 'long' : derived.short.dayRealized < 0 ? 'short' : 'neutral',
                      },
                      {
                        label: 'плав.',
                        value: derived.short.count > 0 ? fmtSigned(derived.short.floatingGross) : '—',
                        tone: derived.short.floatingGross > 0 ? 'long' : derived.short.floatingGross < 0 ? 'short' : 'neutral',
                      },
                      { label: 'входы → ТР', value: sideEntries('S') },
                    ]}
                  />
                </div>

                {/* 2.10 «Спасатель» (визуальное эхо, v1) */}
                <RescuerEcho />

                {/* 2.11 Журнал бота */}
                <Panel
                  title="Журнал бота"
                  actions={
                    eng.journal.length > 10 ? (
                      <button
                        type="button"
                        onClick={() => setJournalFull((v) => !v)}
                        className="cursor-pointer text-[12px] font-medium text-brand transition-opacity hover:opacity-80"
                      >
                        {journalFull ? 'Свернуть' : 'Весь журнал →'}
                      </button>
                    ) : undefined
                  }
                >
                  <JournalFeed entries={eng.journal} limit={journalFull ? 50 : 10} />
                </Panel>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* 4. Confirm-диалог сброса */}
      <ConfirmResetModal
        open={resetOpen}
        symbol={eng.symbol}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          eng.actions.reset();
          setResetOpen(false);
        }}
      />
    </div>
  );
}
