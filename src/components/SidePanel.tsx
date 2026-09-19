import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SidePanelProps {
  side: 'L' | 'S';
  title?: string;
  rows?: Array<{ label: string; value: string; tone?: 'neutral' | 'long' | 'short' | 'warn' }>;
  className?: string;
  children?: ReactNode;
}

const TONE: Record<string, string> = {
  neutral: 'text-primary2',
  long: 'text-up',
  short: 'text-down',
  warn: 'text-warn',
};

/** Полупрозрачная панель стороны ЛОНГ/ШОРТ с левой кромкой 2px. */
export default function SidePanel({ side, title, rows = [], className, children }: SidePanelProps) {
  const isL = side === 'L';
  return (
    <div
      className={cn(
        'rounded-xl border-l-2 p-3',
        isL ? 'border-up bg-up/10' : 'border-down bg-down/10',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', isL ? 'bg-up' : 'bg-down')} />
        <span
          className={cn(
            'text-[11px] font-semibold uppercase tracking-[0.08em]',
            isL ? 'text-up' : 'text-down',
          )}
        >
          {title ?? (isL ? 'ЛОНГ' : 'ШОРТ')}
        </span>
      </div>
      {rows.length > 0 && (
        <dl className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-2">
              <dt className="text-[11px] text-muted2">{r.label}</dt>
              <dd className={cn('font-mono text-[12px] font-medium', TONE[r.tone ?? 'neutral'])}>
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </div>
  );
}
