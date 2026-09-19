import { motion } from 'framer-motion';
import { useEngine } from '@/engine/EngineContext';
import Panel from '@/components/Panel';
import { cn } from '@/lib/utils';

function fmt(n: number, digits = 1): string {
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Секция «Символ»: выбор активного инструмента paper-конвейера. */
export default function SymbolPicker() {
  const eng = useEngine();

  return (
    <Panel title="Символ конвейера">
      <p className="mb-3 text-[11px] leading-snug text-faint">
        Активный инструмент: котировки, свечи и все уровни пересчитываются под него. Набор символов
        зафиксирован в v1 — как в приложении.
      </p>
      <div className="flex flex-wrap gap-2">
        {eng.symbols.map((s, i) => {
          const active = s === eng.symbol;
          const price = eng.prices[s];
          return (
            <motion.button
              key={s}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, duration: 0.15 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => eng.actions.setSymbol(s)}
              className={cn(
                'flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors',
                active
                  ? 'border-brand bg-brand/15'
                  : 'border-subtle bg-cardbg hover:border-brand/50',
              )}
            >
              <span
                className={cn(
                  'font-mono text-[13px] font-semibold',
                  active ? 'text-brand' : 'text-primary2',
                )}
              >
                {s}
              </span>
              <span className="font-mono text-[11px] text-faint">
                {Number.isFinite(price) ? `${fmt(price)} USDT` : 'ожидание цены…'}
              </span>
            </motion.button>
          );
        })}
      </div>
    </Panel>
  );
}
