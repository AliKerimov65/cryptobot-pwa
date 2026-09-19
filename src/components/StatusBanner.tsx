import { motion } from 'framer-motion';
import type { JSX } from 'react';
import { cn } from '@/lib/utils';

export type BannerVariant = 'warn' | 'short' | 'neutral';

const STYLE: Record<BannerVariant, { box: string; iconColor: string; icon: JSX.Element }> = {
  warn: {
    box: 'border-warn/40 bg-warn/10 text-warn',
    iconColor: 'text-warn',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
    ),
  },
  short: {
    box: 'border-down/40 bg-down/10 text-down',
    iconColor: 'text-down',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
    ),
  },
  neutral: {
    box: 'border-subtle bg-cardbg text-muted2',
    iconColor: 'text-muted2',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    ),
  },
};

interface StatusBannerProps {
  variant: BannerVariant;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Полноширинный баннер под хедером с раскрытием height 0→auto. */
export default function StatusBanner({ variant, text, actionLabel, onAction }: StatusBannerProps) {
  const s = STYLE[variant];
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div
        className={cn(
          'mb-3 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[12px] leading-snug',
          s.box,
        )}
      >
        <span className={cn('shrink-0', s.iconColor)}>{s.icon}</span>
        <span className="flex-1 text-primary2/90">{text}</span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 cursor-pointer rounded-lg border border-current px-2.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-80"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </motion.div>
  );
}
