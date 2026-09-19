import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useEngine } from '@/engine/EngineContext';
import JournalFeed from '@/components/JournalFeed';
import { cn } from '@/lib/utils';

interface FilterDef {
  id: string;
  label: string;
  icons: string[] | null; // null = все
}

const FILTERS: FilterDef[] = [
  { id: 'all', label: 'Все', icons: null },
  { id: 'exec', label: '⚡ Исполнения', icons: ['⚡'] },
  { id: 'mode', label: '🧭 Режим', icons: ['🧭', '🛡'] },
  { id: 'veto', label: '🚫 Вето', icons: ['🚫'] },
  { id: 'tp', label: '✅ ТР', icons: ['✅'] },
];

/** Лента режимных сигналов конвейера с фильтрами-чипами. */
export default function SignalFeed() {
  const eng = useEngine();
  const [filterId, setFilterId] = useState('all');

  const filter = FILTERS.find((f) => f.id === filterId) ?? FILTERS[0];
  const entries = useMemo(() => {
    if (!filter.icons) return eng.journal;
    return eng.journal.filter((e) => filter.icons!.some((ic) => e.icon.startsWith(ic)));
  }, [eng.journal, filter]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = f.id === filterId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterId(f.id)}
              className={cn(
                'cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                active
                  ? 'border-brand/40 bg-brand/15 text-brand'
                  : 'border-subtle bg-cardbg text-muted2 hover:text-primary2',
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <motion.div
        key={filterId}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="max-h-[320px] overflow-y-auto pr-1"
      >
        <JournalFeed
          entries={entries}
          limit={50}
          emptyText="По этому фильтру событий пока нет — конвейер запишет сигналы после запуска"
        />
      </motion.div>
    </div>
  );
}
