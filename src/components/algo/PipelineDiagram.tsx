import { useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Anchor, ArrowRight, Crosshair, Flag, Layers, Ruler } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { JSX } from 'react';
import { useEngine } from '@/engine/EngineContext';
import { cn } from '@/lib/utils';

type NodeId = 'anchor' | 'step' | 'catcher' | 'leg' | 'tp';

interface PipeNode {
  id: NodeId;
  icon: LucideIcon;
  title: string;
  value: string;
  note: string;
  chip?: string;
  detail: JSX.Element;
}

function fmt(n: number, digits = 1): string {
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function SettingsLink({ children }: { children: string }) {
  return (
    <Link
      to="/settings"
      className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-brand hover:underline"
    >
      {children}
      <ArrowRight size={12} strokeWidth={2} />
    </Link>
  );
}

function DetailText({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] leading-relaxed text-muted2">{children}</p>;
}

/** Интерактивная схема конвейера: якорь → stepG → перехватчик → нога → тейк. */
export default function PipelineDiagram() {
  const eng = useEngine();
  const [openId, setOpenId] = useState<NodeId | null>(null);

  const margin = eng.equity * eng.legEquityPct;
  const notional = Math.max(margin * eng.leverage, 5);
  const mult = eng.trendDir !== 0 ? 0.3 : 0.5;

  // Активная ступень пайплайна по состоянию движка
  const activeId: NodeId = !eng.running
    ? 'anchor'
    : eng.legsL + eng.legsS > 0
      ? 'leg'
      : eng.pendingL != null || eng.pendingS != null
        ? 'catcher'
        : 'step';

  const nodes: PipeNode[] = [
    {
      id: 'anchor',
      icon: Anchor,
      title: 'Якорь',
      value: eng.anchor != null ? `${fmt(eng.anchor)} USDT` : 'не задан',
      note: 'цена старта · пересчёт шага — периодический + при смене режима',
      detail: (
        <div className="space-y-1.5">
          <DetailText>
            Якорь — цена, от которой вооружаются перехватчики. Ставится при первом запуске
            конвейера; шаг пересчитывается по ATR(14, 15м) на каждой закрытой 15-минутной свече и
            при смене тренд-режима R190.
          </DetailText>
          <DetailText>
            Текущий якорь:{' '}
            <span className="font-mono text-primary2">
              {eng.anchor != null ? fmt(eng.anchor) : '—'}
            </span>
            {' · '}режим:{' '}
            <span className="font-mono text-primary2">
              {eng.trendDir === 1 ? 'тренд ЛОНГ' : eng.trendDir === -1 ? 'тренд ШОРТ' : 'двусторонний'}
            </span>
          </DetailText>
          <SettingsLink>Сброс якоря — через сброс paper-порта в Настройках</SettingsLink>
        </div>
      ),
    },
    {
      id: 'step',
      icon: Ruler,
      title: 'Шаг stepG',
      value: `${(eng.stepG * 100).toFixed(2)}%`,
      note: 'clamp(k × ATR(14, 15м) / цена, 0.0015, 0.02)',
      chip: `k = ${eng.k.toFixed(1)}`,
      detail: (
        <div className="space-y-1.5">
          <DetailText>
            <span className="font-mono text-[12px] text-primary2">
              stepG = clamp(k × ATR(14, 15м) / цена, 0.0015, 0.02)
            </span>
          </DetailText>
          <DetailText>
            Шаг ограничен коридором 0.15%…2%: в штиль конвейер не расползается, в бурю — не
            дробится. Коэффициент k масштабирует волатильность ATR в расстояние между уровнями.
          </DetailText>
          <SettingsLink>Коэффициент k — в Настройках</SettingsLink>
        </div>
      ),
    },
    {
      id: 'catcher',
      icon: Crosshair,
      title: 'Перехватчик',
      value: `вход ∓${mult.toFixed(1)}×stepG · ТР ±1.0×stepG`,
      note: 'половина ноги (q0 × 0.5)',
      chip: eng.trendDir !== 0 ? 'R190: про-тренд 0.3×stepG' : 'двусторонний режим',
      detail: (
        <div className="space-y-1.5">
          <DetailText>
            Перехватчик — отложенная заявка на половину ноги. Без тренда входы симметричны:
            ЛОНГ на −0.5×stepG от якоря, ШОРТ на +0.5×stepG. Тейк — 1.0×stepG от входа.
          </DetailText>
          <DetailText>
            R190: при ADX(14, 1ч) &gt; 25 про-трендовый вход сдвигается к цене (0.3×stepG), а
            контр-трендовый перехватчик не вооружается вовсе.
          </DetailText>
          <DetailText>
            Сейчас: ЛОНГ{' '}
            <span className="font-mono text-up">
              {eng.pendingL != null ? `@ ${fmt(eng.pendingL)}` : 'ожидание'}
            </span>
            {' · '}ШОРТ{' '}
            <span className="font-mono text-down">
              {eng.pendingS != null ? `@ ${fmt(eng.pendingS)}` : 'ожидание'}
            </span>
          </DetailText>
        </div>
      ),
    },
    {
      id: 'leg',
      icon: Layers,
      title: 'Нога',
      value: `маржа = ${(eng.legEquityPct * 100).toFixed(1)}% эквити × плечо ${eng.leverage}x`,
      note: `номинал ≈ ${fmt(notional, 1)} USDT`,
      chip: 'мин. 5 USDT (Bybit)',
      detail: (
        <div className="space-y-1.5">
          <DetailText>
            <span className="font-mono text-[12px] text-primary2">
              маржа = {(eng.legEquityPct * 100).toFixed(1)}% × эквити × плечо; номинал = маржа ×
              плечо
            </span>
          </DetailText>
          <DetailText>
            Сейчас: маржа <span className="font-mono text-primary2">{fmt(margin)} USDT</span>,
            номинал <span className="font-mono text-primary2">{fmt(notional, 1)} USDT</span>
            {' '}(перехватчик — половина). Если номинал ниже биржевого минимума 5 USDT, он поднимается
            до минимума.
          </DetailText>
          <SettingsLink>Плечо и % эквити на ногу — в Настройках</SettingsLink>
        </div>
      ),
    },
    {
      id: 'tp',
      icon: Flag,
      title: 'Тейк / учёт',
      value: 'taker 0.068% · maker 0.029%',
      note: 'эквити = кэш + реализ. ПнЛ − комиссии',
      detail: (
        <div className="space-y-1.5">
          <DetailText>
            Закрытие — касанием уровня ТР (high/low минутной свечи, между свечами — тикер).
            Paper-заполнения идут по taker 0.068% на вход и на выход — боевые константы приложения.
          </DetailText>
          <DetailText>
            Сделок: <span className="font-mono text-primary2">{eng.trades}</span>, винрейт{' '}
            <span className="font-mono text-primary2">{eng.wr.toFixed(0)}%</span>, реализ. сутки
            (UTC){' '}
            <span className="font-mono text-primary2">{fmt(eng.dayRealized)} USDT</span>.
          </DetailText>
        </div>
      ),
    },
  ];

  const openNode = nodes.find((n) => n.id === openId) ?? null;

  return (
    <div>
      {/* Бегущая точка / марширующий пунктир — локальные keyframes компонента */}
      <style>{`
        @keyframes pipe-dash { to { background-position-x: 24px; } }
        @keyframes pipe-dash-v { to { background-position-y: 24px; } }
        @keyframes pipe-dot { 0% { left: 0; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { left: calc(100% - 6px); opacity: 0; } }
        @keyframes pipe-dot-v { 0% { top: 0; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { top: calc(100% - 6px); opacity: 0; } }
        @keyframes pipe-glow { 0%, 100% { box-shadow: 0 0 0 0 rgb(109 141 255 / 0.0); } 50% { box-shadow: 0 0 0 3px rgb(109 141 255 / 0.18); } }
        .pipe-line { background-image: linear-gradient(90deg, #232A38 55%, transparent 45%); background-size: 12px 1px; animation: pipe-dash 3s linear infinite; }
        .pipe-line-v { background-image: linear-gradient(180deg, #232A38 55%, transparent 45%); background-size: 1px 12px; animation: pipe-dash-v 3s linear infinite; }
        .pipe-dot { animation: pipe-dot 3s linear infinite; }
        .pipe-dot-v { animation: pipe-dot-v 3s linear infinite; }
        .pipe-active { animation: pipe-glow 1.6s ease-in-out infinite; }
      `}</style>

      {/* Схема: вертикальная на мобильном, горизонтальная на десктопе */}
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        {nodes.map((node, i) => {
          const Icon = node.icon;
          const isActive = node.id === activeId;
          const isOpen = node.id === openId;
          return (
            <div key={node.id} className="flex flex-col sm:flex-1 sm:flex-row sm:items-stretch">
              {i > 0 && (
                <>
                  {/* мобильный вертикальный коннектор */}
                  <div className="relative ml-6 h-6 w-px pipe-line-v sm:hidden">
                    <span className="pipe-dot-v absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-brand" />
                  </div>
                  {/* десктопный горизонтальный коннектор */}
                  <div className="relative mx-1 hidden w-6 shrink-0 self-center sm:block">
                    <div className="pipe-line h-px w-full" />
                    <span className="pipe-dot absolute -top-[3px] h-1.5 w-1.5 rounded-full bg-brand" />
                  </div>
                </>
              )}
              <motion.button
                type="button"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3, ease: 'easeOut' }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setOpenId(isOpen ? null : node.id)}
                className={cn(
                  'w-full cursor-pointer rounded-xl border bg-[#141824] p-3 text-left transition-colors duration-150 sm:flex-1',
                  isActive ? 'border-brand pipe-active' : 'border-subtle hover:border-brand/60',
                  isOpen && 'border-brand',
                )}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <Icon size={15} strokeWidth={1.75} className={isActive ? 'text-brand' : 'text-muted2'} />
                    <span className="text-[12px] font-semibold text-primary2">{node.title}</span>
                  </span>
                  {isActive && (
                    <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-brand">
                      сейчас
                    </span>
                  )}
                </div>
                <p className="font-mono text-[12px] leading-snug text-primary2">{node.value}</p>
                <p className="mt-1 text-[10.5px] leading-snug text-faint">{node.note}</p>
                {node.chip && (
                  <span className="mt-1.5 inline-block rounded-full border border-subtle bg-cardbg px-2 py-0.5 font-mono text-[10px] text-muted2">
                    {node.chip}
                  </span>
                )}
              </motion.button>
            </div>
          );
        })}
      </div>

      {/* Аккордеон-детализация узла */}
      <AnimatePresence initial={false}>
        {openNode && (
          <motion.div
            key={openNode.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-brand/30 bg-brand/5 p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand">
                {openNode.title} — детали
              </p>
              {openNode.detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
