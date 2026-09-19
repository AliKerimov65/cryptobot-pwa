import { AnimatePresence, motion } from 'framer-motion';
import type { JournalEntry } from '@/engine/EngineContext';

interface JournalFeedProps {
  entries: JournalEntry[];
  limit?: number;
  emptyText?: string;
}

function fmtTime(t: number): string {
  return new Date(t).toLocaleTimeString('ru-RU', { hour12: false });
}

/** Лента событий с эмодзи-маркерами; новые записи влетают сверху. */
export default function JournalFeed({ entries, limit = 50, emptyText }: JournalFeedProps) {
  const list = entries.slice(0, limit);
  if (!list.length) {
    return (
      <p className="py-4 text-center text-[12px] text-faint">
        {emptyText ?? 'Журнал пуст — события появятся после запуска конвейера'}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-[#1A2030]">
      <AnimatePresence initial={false}>
        {list.map((e) => (
          <motion.li
            key={e.id}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-baseline gap-2 py-1.5"
          >
            <span className="shrink-0 text-[13px] leading-none">{e.icon}</span>
            <span className="shrink-0 font-mono text-[11px] text-faint">{fmtTime(e.t)}</span>
            <span className="min-w-0 flex-1 text-[13px] leading-snug text-primary2/90">
              {e.text}
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
