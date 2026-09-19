import { motion } from 'framer-motion';
import MetricChip from '@/components/MetricChip';
import { cn } from '@/lib/utils';

function fmtSigned(n: number, digits = 2): string {
  const s = n > 0 ? '+' : n < 0 ? '−' : '';
  const abs = Math.abs(n).toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${s}${abs}`;
}

interface DayPanelProps {
  dayKey: string; // YYYY-MM-DD (UTC)
  dayRealized: number;
  tradesToday: number;
}

/**
 * Суточная статистика UTC: текущие сутки (живые данные движка) +
 * мини-гистограмма последних 7 UTC-суток (история накапливается онлайн).
 */
export default function DayPanel({ dayKey, dayRealized, tradesToday }: DayPanelProps) {
  const dayStart = Date.parse(`${dayKey}T00:00:00Z`);
  const days = Array.from({ length: 7 }, (_, i) => {
    const t = dayStart - (6 - i) * 86_400_000;
    const d = new Date(t);
    const label = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
    const isToday = i === 6;
    const value = isToday ? dayRealized : null;
    return { label, isToday, value };
  });

  const heightFor = (v: number): number => Math.min(64, Math.max(10, Math.abs(v) * 4));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricChip label="Дата UTC" value={dayKey} />
        <MetricChip
          label="Реализ. за сутки"
          value={`${fmtSigned(dayRealized)} USDT`}
          variant={dayRealized >= 0 ? 'long' : 'short'}
        />
        <MetricChip label="Сделок сегодня" value={String(tradesToday)} variant="accent" />
      </div>

      <div>
        <div className="flex h-[84px] items-end justify-between gap-2">
          {days.map((d, i) => (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
              {d.value != null ? (
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.4, delay: i * 0.06, ease: 'easeOut' }}
                  style={{ height: heightFor(d.value), transformOrigin: 'bottom' }}
                  className={cn(
                    'w-full max-w-[28px] rounded-t-md',
                    d.value >= 0 ? 'bg-up/80' : 'bg-down/80',
                  )}
                  title={`${d.label}: ${fmtSigned(d.value)} USDT · ${tradesToday} сделок`}
                />
              ) : (
                <div
                  className="h-1.5 w-full max-w-[28px] rounded-full bg-gridline"
                  title={`${d.label}: нет данных — история накапливается`}
                />
              )}
              <span
                className={cn(
                  'font-mono text-[10px]',
                  d.isToday ? 'text-primary2' : 'text-faint',
                )}
              >
                {d.label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-faint">
          Журнал суток ведётся с момента запуска зеркала: прошлые дни появятся по мере работы
          конвейера.
        </p>
      </div>
    </div>
  );
}
