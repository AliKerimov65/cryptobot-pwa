import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Minus, Plus } from 'lucide-react';
import { useEngine } from '@/engine/EngineContext';
import Panel from '@/components/Panel';
import { cn } from '@/lib/utils';

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function Row({
  title,
  hint,
  children,
  index,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2, ease: 'easeOut' }}
      className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1A2030] py-3 last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-primary2">{title}</p>
        {hint != null && <p className="mt-0.5 text-[11px] leading-snug text-faint">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </motion.div>
  );
}

function Stepper({
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  const btn =
    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-subtle bg-cardbg text-muted2 transition-colors hover:border-brand/60 hover:text-primary2 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Уменьшить"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className={btn}
      >
        <Minus size={14} strokeWidth={2} />
      </button>
      <span className="min-w-[52px] text-center font-mono text-[13px] font-semibold text-primary2">
        {format(value)}
      </span>
      <button
        type="button"
        aria-label="Увеличить"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className={btn}
      >
        <Plus size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

/** Секция «Конвейер (paper)»: плечо, k, маржа ноги, стартовое эквити, комиссии. */
export default function ConveyorParams() {
  const eng = useEngine();
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSaved = () => {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  };

  const apply = (p: Partial<{ k: number; leverage: number; legEquityPct: number }>) => {
    eng.actions.setParams(p);
    markSaved();
  };

  const margin = eng.equity * eng.legEquityPct;
  const notional = Math.max(margin * eng.leverage, 5);

  return (
    <Panel
      title="Конвейер (paper)"
      actions={
        <AnimatePresence>
          {saved && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1 rounded-full border border-up/40 bg-up/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-up"
            >
              <Check size={11} strokeWidth={2.5} />
              Сохранено
            </motion.span>
          )}
        </AnimatePresence>
      }
    >
      <Row
        index={0}
        title="Плечо по умолчанию"
        hint="Влияет на маржу и номинал ноги; ликвидация в paper v1 не моделируется"
      >
        <Stepper
          value={eng.leverage}
          min={1}
          max={25}
          step={1}
          format={(v) => `${v}x`}
          onChange={(v) => apply({ leverage: v })}
        />
      </Row>

      <Row
        index={1}
        title="Коэффициент шага k"
        hint={
          <>
            <span className="font-mono">stepG = clamp(k × ATR(14, 15м) / цена, 0.0015, 0.02)</span>
          </>
        }
      >
        <Stepper
          value={eng.k}
          min={0.3}
          max={1.2}
          step={0.1}
          format={(v) => v.toFixed(1)}
          onChange={(v) => apply({ k: v })}
        />
      </Row>

      <Row
        index={2}
        title="Маржа ноги, % эквити"
        hint={`→ номинал ${fmt(notional, 1)} USDT при эквити ${fmt(eng.equity, 0)} × ${eng.leverage}x (мин. 5 USDT)`}
      >
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.5}
            max={5}
            step={0.1}
            value={eng.legEquityPct * 100}
            onChange={(e) => apply({ legEquityPct: Number(e.target.value) / 100 })}
            className="h-1.5 w-[130px] cursor-pointer accent-[#6D8DFF] sm:w-[180px]"
            aria-label="Маржа ноги, процент эквити"
          />
          <span className="min-w-[44px] text-right font-mono text-[13px] font-semibold text-primary2">
            {(eng.legEquityPct * 100).toFixed(1)}%
          </span>
        </div>
      </Row>

      <Row
        index={3}
        title="Стартовое эквити"
        hint="Константа приложения — 1 000 USDT; сброс возвращает paper-порт к старту"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-semibold text-primary2">
            {fmt(1000, 0)} USDT
          </span>
          <button
            type="button"
            onClick={() => {
              if (confirmReset) {
                eng.actions.reset();
                setConfirmReset(false);
                markSaved();
              } else {
                setConfirmReset(true);
                if (resetTimer.current) clearTimeout(resetTimer.current);
                resetTimer.current = setTimeout(() => setConfirmReset(false), 3000);
              }
            }}
            className={cn(
              'cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
              confirmReset
                ? 'border-down/50 bg-down/15 text-down'
                : 'border-subtle bg-cardbg text-muted2 hover:text-primary2',
            )}
          >
            {confirmReset ? 'Подтвердить сброс' : 'Сбросить до 1 000'}
          </button>
        </div>
      </Row>

      <Row
        index={4}
        title="Комиссии"
        hint="Боевые константы приложения; paper-заполнения — по taker"
      >
        <div className="flex gap-1.5">
          <span className="rounded-full border border-subtle bg-cardbg px-2 py-1 font-mono text-[11px] text-muted2">
            taker 0.068%
          </span>
          <span className="rounded-full border border-subtle bg-cardbg px-2 py-1 font-mono text-[11px] text-muted2">
            maker 0.029%
          </span>
        </div>
      </Row>

      <Row index={5} title="Мин. номинал ордера" hint="Биржевой минимум Bybit для USDT-перпетуалов">
        <span className="rounded-full border border-subtle bg-cardbg px-2 py-1 font-mono text-[11px] text-muted2">
          5 USDT
        </span>
      </Row>
    </Panel>
  );
}
