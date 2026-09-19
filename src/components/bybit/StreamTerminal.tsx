import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Terminal } from 'lucide-react';
import Panel from '@/components/Panel';
import { useEngine } from '@/engine/EngineContext';

interface Line {
  id: number;
  t: number;
  text: string;
}

const MAX_LINES = 20;

function fmtTime(t: number): string {
  const d = new Date(t);
  const base = d.toLocaleTimeString('ru-RU', { hour12: false, timeZone: 'UTC' });
  return `${base}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function fmtPx(n: number): string {
  const digits = n >= 1000 ? 1 : n >= 1 ? 2 : 4;
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  });
}

/**
 * Терминал потока: человекочитаемые строки по живым WS-обновлениям контекста
 * (tickers наблюдаемых символов, смена статуса, kline активного) + статистика топиков.
 * Автоскролл вниз, пауза при ручном скролле, «Очистить».
 */
export default function StreamTerminal() {
  const eng = useEngine();
  const [lines, setLines] = useState<Line[]>([]);
  const idRef = useRef(0);
  const lastLoggedRef = useRef<Record<string, number>>({});
  const prevStatusRef = useRef(eng.wsStatus);
  const prevSymbolRef = useRef(eng.symbol);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  const push = useCallback((text: string) => {
    setLines((cur) => {
      const next = [...cur, { id: ++idRef.current, t: Date.now(), text }];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  }, []);

  // Тикеры наблюдаемых символов (только при реальном изменении цены)
  useEffect(() => {
    for (const sym of eng.symbols) {
      const p = eng.prices[sym];
      if (!Number.isFinite(p)) continue;
      if (lastLoggedRef.current[sym] !== p) {
        lastLoggedRef.current[sym] = p;
        push(`tickers.${sym} last=${fmtPx(p)}`);
      }
    }
  }, [eng.prices, eng.symbols, push]);

  // Смена статуса соединения
  useEffect(() => {
    if (prevStatusRef.current !== eng.wsStatus) {
      push(`статус → ${eng.wsStatus}`);
      prevStatusRef.current = eng.wsStatus;
    }
  }, [eng.wsStatus, push]);

  // Смена активного символа — переподписка kline
  useEffect(() => {
    if (prevSymbolRef.current !== eng.symbol) {
      push(`subscribe kline.1/3/5/15/30/60.${eng.symbol}`);
      prevSymbolRef.current = eng.symbol;
    }
  }, [eng.symbol, push]);

  // Автоскролл вниз, если пользователь не скроллит вручную
  useEffect(() => {
    const el = scrollRef.current;
    if (el && !pausedRef.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pausedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 24;
  };

  const topicsCount = eng.symbols.length + 6;

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Terminal size={15} className="text-brand" />
          Поток
        </span>
      }
      actions={
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => setLines([])}
          className="cursor-pointer rounded-lg border border-subtle px-2.5 py-1 text-[11px] font-medium text-muted2 transition-colors hover:text-primary2"
        >
          Очистить
        </motion.button>
      }
    >
      <p className="mb-2 font-mono text-[10px] text-faint">
        подписки: {topicsCount} топиков · tickers ×{eng.symbols.length} + kline ×6 ({eng.symbol}) ·
        ping-кадр каждые 20 с
      </p>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-[220px] overflow-y-auto rounded-xl bg-[#0A0D12] p-3 font-mono text-[11px] leading-relaxed"
      >
        {lines.length === 0 ? (
          <p className="text-faint">
            Поток пуст — строки появятся с первыми WS-тиками наблюдаемых символов
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {lines.map((l) => (
              <motion.p
                key={l.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="whitespace-nowrap text-primary2/85"
              >
                <span className="text-faint">{fmtTime(l.t)}</span> {l.text}
              </motion.p>
            ))}
          </AnimatePresence>
        )}
      </div>
    </Panel>
  );
}
