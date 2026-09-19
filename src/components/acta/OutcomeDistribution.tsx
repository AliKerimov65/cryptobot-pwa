import { motion } from 'framer-motion';
import type { JournalEntry, SideStats } from '@/engine/EngineContext';

function fmtTimeUtc(t: number): string {
  return `${new Date(t).toLocaleTimeString('ru-RU', { hour12: false, timeZone: 'UTC' })} UTC`;
}

interface OutcomeDistributionProps {
  statsL: SideStats;
  statsS: SideStats;
  closed: JournalEntry[]; // записи журнала с иконками ✅ / 🛑 (новые первыми)
}

interface RowProps {
  label: string;
  wins: number;
  losses: number;
  delay: number;
}

function OutcomeRow({ label, wins, losses, delay }: RowProps) {
  const total = wins + losses;
  const winPct = total > 0 ? (wins / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-muted2">{label}</span>
        <span className="font-mono text-faint">
          <span className="text-up">{wins}</span>
          {' / '}
          <span className="text-down">{losses}</span>
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[#0A0D12]">
        {total > 0 && (
          <>
            <motion.div
              className="h-full bg-up/80"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              style={{ width: `${winPct}%`, transformOrigin: 'left' }}
              transition={{ duration: 0.4, delay, ease: 'easeOut' }}
            />
            <motion.div
              className="h-full flex-1 bg-down/80"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              style={{ transformOrigin: 'left' }}
              transition={{ duration: 0.4, delay: delay + 0.05, ease: 'easeOut' }}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Распределение исходов сделок (победы/потери по сторонам) + последние закрытые сделки. */
export default function OutcomeDistribution({ statsL, statsS, closed }: OutcomeDistributionProps) {
  const totalTrades = statsL.trades + statsS.trades;
  const last = closed.slice(0, 5);

  if (totalTrades === 0) {
    return (
      <p className="py-4 text-center text-[12px] text-faint">
        Сделок пока нет — распределение появится после первых закрытых ТР
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <OutcomeRow
          label="ЛОНГ · победы / потери"
          wins={statsL.wins}
          losses={statsL.trades - statsL.wins}
          delay={0}
        />
        <OutcomeRow
          label="ШОРТ · победы / потери"
          wins={statsS.wins}
          losses={statsS.trades - statsS.wins}
          delay={0.08}
        />
        <OutcomeRow
          label="Итого"
          wins={statsL.wins + statsS.wins}
          losses={totalTrades - statsL.wins - statsS.wins}
          delay={0.16}
        />
      </div>

      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
          Последние закрытые сделки
        </p>
        {last.length ? (
          <ul className="space-y-1.5">
            {last.map((e, i) => (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05, ease: 'easeOut' }}
                className="flex items-baseline gap-2 font-mono text-[11px] leading-snug"
              >
                <span>{e.icon}</span>
                <span className="min-w-0 flex-1 truncate text-primary2/90">{e.text}</span>
                <span className="shrink-0 text-faint">{fmtTimeUtc(e.t)}</span>
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-faint">Записей о закрытиях в журнале нет</p>
        )}
      </div>
    </div>
  );
}
