import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  title?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Карточка раздела: bg-card rounded-2xl border-subtle p-4, заголовок + слот действий. */
export default function Panel({ title, actions, className, children }: PanelProps) {
  return (
    <section className={cn('rounded-2xl border border-subtle bg-cardbg p-4', className)}>
      {(title != null || actions != null) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-primary2">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
