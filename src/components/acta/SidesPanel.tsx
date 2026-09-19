import { motion } from 'framer-motion';
import SidePanel from '@/components/SidePanel';
import type { SideStats } from '@/engine/EngineContext';

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

interface SidesPanelProps {
  statsL: SideStats;
  statsS: SideStats;
}

/** Реализ. по сторонам: две SidePanel + diverging-бар ЛОНГ влево / ШОРТ вправо. */
export default function SidesPanel({ statsL, statsS }: SidesPanelProps) {
  const wrL = statsL.trades > 0 ? (statsL.wins / statsL.trades) * 100 : 0;
  const wrS = statsS.trades > 0 ? (statsS.wins / statsS.trades) * 100 : 0;
  const avgL = statsL.trades > 0 ? statsL.realized / statsL.trades : 0;
  const avgS = statsS.trades > 0 ? statsS.realized / statsS.trades : 0;

  const absL = Math.abs(statsL.realized);
  const absS = Math.abs(statsS.realized);
  const total = absL + absS || 1;
  const shareL = absL / total;
  const shareS = absS / total;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SidePanel
          side="L"
          rows={[
            {
              label: 'Реализовано',
              value: `${fmtSigned(statsL.realized)} USDT`,
              tone: statsL.realized >= 0 ? 'long' : 'short',
            },
            { label: 'Сделок', value: String(statsL.trades) },
            { label: 'WR стороны', value: `${wrL.toFixed(1)}%` },
            { label: 'Средний ПнЛ', value: fmtSigned(avgL), tone: avgL >= 0 ? 'long' : 'short' },
          ]}
        />
        <SidePanel
          side="S"
          rows={[
            {
              label: 'Реализовано',
              value: `${fmtSigned(statsS.realized)} USDT`,
              tone: statsS.realized >= 0 ? 'long' : 'short',
            },
            { label: 'Сделок', value: String(statsS.trades) },
            { label: 'WR стороны', value: `${wrS.toFixed(1)}%` },
            { label: 'Средний ПнЛ', value: fmtSigned(avgS), tone: avgS >= 0 ? 'long' : 'short' },
          ]}
        />
      </div>

      {/* Diverging-бар: ЛОНГ влево от центра, ШОРТ вправо */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px]">
          <span className="text-up">{fmtSigned(statsL.realized)}</span>
          <span className="text-[10px] uppercase tracking-[0.08em] text-faint">
            баланс сторон
          </span>
          <span className="text-down">{fmtSigned(statsS.realized)}</span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-[#0A0D12]">
          <div className="absolute inset-y-0 left-1/2 w-px bg-subtle" />
          <motion.div
            className="absolute inset-y-0 right-1/2 rounded-l-full bg-up/80"
            initial={{ width: 0 }}
            animate={{ width: `${shareL * 50}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute inset-y-0 left-1/2 rounded-r-full bg-down/80"
            initial={{ width: 0 }}
            animate={{ width: `${shareS * 50}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  );
}
