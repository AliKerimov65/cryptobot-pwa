import { cn } from '@/lib/utils';

export type MetricVariant = 'neutral' | 'long' | 'short' | 'warn' | 'accent';

const VALUE_COLOR: Record<MetricVariant, string> = {
  neutral: 'text-primary2',
  long: 'text-up',
  short: 'text-down',
  warn: 'text-warn',
  accent: 'text-brand',
};

interface MetricChipProps {
  label: string;
  value: string;
  variant?: MetricVariant;
  className?: string;
}

/** Маленькая метрика: подпись капсом 10px + значение mono 13px. */
export default function MetricChip({ label, value, variant = 'neutral', className }: MetricChipProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
        {label}
      </span>
      <span className={cn('truncate font-mono text-[13px] font-medium', VALUE_COLOR[variant])}>
        {value}
      </span>
    </div>
  );
}
