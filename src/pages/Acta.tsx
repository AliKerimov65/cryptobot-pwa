import { useEffect, useMemo, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { BarChart3, Download, FileText, Map as MapIcon } from 'lucide-react';
import { useEngine } from '@/engine/EngineContext';
import Panel from '@/components/Panel';
import JournalFeed from '@/components/JournalFeed';
import EquityCurveChart from '@/components/acta/EquityCurveChart';
import SidesPanel from '@/components/acta/SidesPanel';
import DayPanel from '@/components/acta/DayPanel';
import OutcomeDistribution from '@/components/acta/OutcomeDistribution';
import { cn } from '@/lib/utils';

type Period = 'day' | 'week' | 'all';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'day', label: 'Сутки' },
  { id: 'week', label: '7 дней' },
  { id: 'all', label: 'Всё время' },
];

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: 'easeOut' as const },
};

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtSigned(n: number, digits = 2): string {
  const s = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${s}${fmt(Math.abs(n), digits)}`;
}

/** Извлечь нетто-ПнЛ из строки журнала «… нетто +3.41 USDT». */
function parseNet(text: string): number | null {
  const m = /нетто ([+-]?\d+(?:\.\d+)?)/.exec(text);
  return m ? Number.parseFloat(m[1]) : null;
}

function isCloseIcon(icon: string): boolean {
  return icon === '✅' || icon === '🛑';
}

/** Count-up число (useSpring), без layout-скачков. */
function CountUp({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const spring = useSpring(value, { duration: 600, bounce: 0 });
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  const text = useTransform(spring, format);
  return <motion.span className={className}>{text}</motion.span>;
}

interface KpiCardProps {
  title: string;
  edge: string; // tailwind border-top color class
  children: React.ReactNode;
  subtitle?: string;
  delay: number;
}

function KpiCard({ title, edge, children, subtitle, delay }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      className={cn('rounded-2xl border border-subtle border-t-2 bg-cardbg p-4', edge)}
    >
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
        {title}
      </p>
      {children}
      {subtitle && <p className="mt-1.5 text-[10px] leading-snug text-faint">{subtitle}</p>}
    </motion.div>
  );
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const FILTERS: { id: string; label: string; icons: string[] }[] = [
  { id: 'all', label: 'Все', icons: [] },
  { id: 'deal', label: '✅ Сделки', icons: ['✅', '🛑'] },
  { id: 'exec', label: '⚡ Исполнение', icons: ['⚡'] },
  { id: 'guard', label: '🛡 Защита', icons: ['🛡'] },
  { id: 'veto', label: '🚫 Вето', icons: ['🚫'] },
  { id: 'mode', label: '🧭 Режим', icons: ['🧭', '▶️', '⏸', '♻️', '🔁', '⏳'] },
];

const ROADMAP: { text: string; version: string }[] = [
  { text: 'Совет сонара (5 голосов) и эмпирическое вето P(BE≤72ч)', version: 'v1.1+' },
  { text: 'Сторож ликвидации', version: 'v1.1+' },
  { text: 'Синхронизация состояния с Android-приложением (relay-сервер)', version: 'v2' },
  { text: 'Живая торговля из браузера (приватное API)', version: 'v2' },
];

export default function Acta() {
  const eng = useEngine();
  const [period, setPeriod] = useState<Period>('all');
  const [filter, setFilter] = useState('all');
  const [savedAs, setSavedAs] = useState<string | null>(null);

  const closedAll = useMemo(
    () => eng.journal.filter((e) => isCloseIcon(e.icon)),
    [eng.journal],
  );

  // Агрегаты за период: «сутки» и «7 дней» — из журнала + счётчиков движка
  const agg = useMemo(() => {
    if (period === 'all') {
      const realized = eng.statsL.realized + eng.statsS.realized;
      const wr = eng.trades > 0 ? (eng.wins / eng.trades) * 100 : 0;
      return { realized, trades: eng.trades, wr, approximate: false };
    }
    // «7 дней» — окно из 7 UTC-суток, включая текущую (от dayKey движка)
    const from =
      period === 'day'
        ? Date.parse(`${eng.dayKey}T00:00:00Z`)
        : Date.parse(`${eng.dayKey}T00:00:00Z`) - 6 * 86_400_000;
    const entries = closedAll.filter((e) => e.t >= from);
    const wins = entries.filter((e) => e.icon === '✅').length;
    if (period === 'day') {
      // реализ. суток — авторитетный счётчик движка
      return {
        realized: eng.dayRealized,
        trades: entries.length,
        wr: entries.length > 0 ? (wins / entries.length) * 100 : 0,
        approximate: false,
      };
    }
    const realized = entries.reduce((sum, e) => sum + (parseNet(e.text) ?? 0), 0);
    return {
      realized,
      trades: entries.length,
      wr: entries.length > 0 ? (wins / entries.length) * 100 : 0,
      approximate: true,
    };
  }, [period, eng.statsL.realized, eng.statsS.realized, eng.trades, eng.wins, eng.dayKey, eng.dayRealized, closedAll]);

  const tradesToday = useMemo(() => {
    const from = Date.parse(`${eng.dayKey}T00:00:00Z`);
    return closedAll.filter((e) => e.t >= from).length;
  }, [closedAll, eng.dayKey]);

  const filteredJournal = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    if (!f.icons.length) return eng.journal;
    return eng.journal.filter((e) => f.icons.includes(e.icon));
  }, [eng.journal, filter]);

  const maxDdUsdt = eng.maxDD * eng.peakEquity;

  const doExport = (kind: 'json' | 'txt') => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    if (kind === 'json') {
      const payload = {
        exportedAt: new Date().toISOString(),
        symbol: eng.symbol,
        equity: eng.equity,
        stats: { trades: eng.trades, wins: eng.wins, wr: eng.wr, maxDD: eng.maxDD, peakEquity: eng.peakEquity, statsL: eng.statsL, statsS: eng.statsS },
        journal: eng.journal,
      };
      downloadFile(`cryptobot-journal-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
    } else {
      const lines = eng.journal.map(
        (e) => `${new Date(e.t).toISOString().replace('T', ' ').slice(0, 19)} UTC  ${e.icon}  ${e.text}`,
      );
      downloadFile(`cryptobot-journal-${stamp}.txt`, lines.join('\n') || 'Журнал пуст', 'text/plain;charset=utf-8');
    }
    setSavedAs(kind);
    window.setTimeout(() => setSavedAs((cur) => (cur === kind ? null : cur)), 1500);
  };

  return (
    <div className="space-y-3">
      {/* 1. Заголовок + период */}
      <motion.div {...fadeUp} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[28px] font-bold tracking-[-0.01em] text-primary2">
            <BarChart3 size={24} className="text-brand" />
            АЦТА
          </h1>
          <p className="mt-0.5 text-[12px] text-muted2">
            Аналитика paper-конвейера · все боты · время UTC
          </p>
        </div>
        <div className="flex rounded-full border border-subtle bg-cardbg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={cn(
                'relative cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
                period === p.id ? 'text-brand' : 'text-muted2 hover:text-primary2',
              )}
            >
              {period === p.id && (
                <motion.span
                  layoutId="period-pill"
                  className="absolute inset-0 rounded-full bg-brand/15"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative">{p.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* 2. KPI-лента */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="Реализованный ПнЛ"
          edge={agg.realized >= 0 ? 'border-t-up' : 'border-t-down'}
          delay={0}
          subtitle={
            agg.approximate
              ? 'оценка по журналу (≤200 записей) · за вычетом комиссий'
              : 'за вычетом комиссий taker 0.068% / maker 0.029%'
          }
        >
          <CountUp
            value={agg.realized}
            format={(v) => `${fmtSigned(v)} USDT`}
            className={cn(
              'font-mono text-[22px] font-bold leading-none',
              agg.realized >= 0 ? 'text-up' : 'text-down',
            )}
          />
        </KpiCard>

        <KpiCard title="Сделок / WR" edge="border-t-brand" delay={0.07} subtitle="винрейт по закрытым ТР">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[22px] font-bold leading-none text-primary2">
              {agg.trades}
            </span>
            <CountUp
              value={agg.wr}
              format={(v) => `· ${v.toFixed(1)}%`}
              className="font-mono text-[14px] font-semibold text-brand"
            />
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#0A0D12]">
            <motion.div
              className="h-full rounded-full bg-brand"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, agg.wr)}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
        </KpiCard>

        <KpiCard title="MaxDD / пик эквити" edge="border-t-warn" delay={0.14} subtitle="мониторинг §5.8 · доля от пика">
          <div className="flex items-baseline gap-1.5 font-mono leading-none">
            <CountUp
              value={-maxDdUsdt}
              format={(v) => fmtSigned(v)}
              className="text-[18px] font-bold text-warn"
            />
            <span className="text-[13px] text-faint">/</span>
            <CountUp
              value={eng.peakEquity}
              format={(v) => fmt(v)}
              className="text-[18px] font-bold text-primary2"
            />
          </div>
          <p className="mt-1 font-mono text-[11px] text-faint">
            просадка {(eng.maxDD * 100).toFixed(1)}% от пика
          </p>
        </KpiCard>

        <KpiCard
          title="Плавающий ПнЛ"
          edge={eng.floatingNet >= 0 ? 'border-t-up' : 'border-t-down'}
          delay={0.21}
          subtitle="открытые ноги по живому тикеру"
        >
          <CountUp
            value={eng.floatingNet}
            format={(v) => `${fmtSigned(v)} USDT`}
            className={cn(
              'font-mono text-[22px] font-bold leading-none',
              eng.floatingNet >= 0 ? 'text-up' : 'text-down',
            )}
          />
        </KpiCard>
      </div>

      {/* 3. Кривая эквити */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
        <Panel title="Эквити конвейера" actions={
          <span className="font-mono text-[11px] text-faint">
            {eng.equityCurve.length} точек · кэш {fmt(eng.cash)} USDT
          </span>
        }>
          <EquityCurveChart points={eng.equityCurve} peak={eng.peakEquity} />
        </Panel>
      </motion.div>

      {/* 4. Стороны + сутки */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.14 }}>
          <Panel title="Реализ. по сторонам">
            <SidesPanel statsL={eng.statsL} statsS={eng.statsS} />
          </Panel>
        </motion.div>
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.18 }}>
          <Panel title="Сутки (UTC)">
            <DayPanel dayKey={eng.dayKey} dayRealized={eng.dayRealized} tradesToday={tradesToday} />
          </Panel>
        </motion.div>
      </div>

      {/* 5. Распределение исходов */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.22 }}>
        <Panel title="Распределение исходов сделок">
          <OutcomeDistribution statsL={eng.statsL} statsS={eng.statsS} closed={closedAll} />
        </Panel>
      </motion.div>

      {/* 6. Журнал конвейера (полный) + экспорт */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.26 }}>
        <Panel
          title="Журнал событий"
          actions={
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => doExport('json')}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-subtle px-2.5 py-1.5 text-[11px] font-medium text-muted2 transition-colors hover:text-primary2"
              >
                <Download size={13} />
                {savedAs === 'json' ? 'Сохранено ✓' : 'Экспорт JSON'}
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => doExport('txt')}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-subtle px-2.5 py-1.5 text-[11px] font-medium text-muted2 transition-colors hover:text-primary2"
              >
                <FileText size={13} />
                {savedAs === 'txt' ? 'Сохранено ✓' : 'Текст'}
              </motion.button>
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  filter === f.id
                    ? 'border-brand/40 bg-brand/15 text-brand'
                    : 'border-subtle text-muted2 hover:text-primary2',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <JournalFeed
            entries={filteredJournal}
            limit={50}
            emptyText="По выбранному фильтру записей нет"
          />
        </Panel>
      </motion.div>

      {/* 7. Дорожная карта (честный блок) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.3, once: true }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="rounded-2xl border border-dashed border-subtle bg-cardbg/50 p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <MapIcon size={15} className="text-brand" />
          <h3 className="text-[13px] font-semibold text-primary2">Что дальше</h3>
        </div>
        <ul className="space-y-1.5">
          {ROADMAP.map((r) => (
            <li key={r.text} className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="text-muted2">{r.text}</span>
              <span className="shrink-0 rounded-full border border-subtle px-2 py-0.5 font-mono text-[10px] text-faint">
                {r.version}
              </span>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
