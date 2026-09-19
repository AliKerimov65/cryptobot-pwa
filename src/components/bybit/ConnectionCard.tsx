import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, RefreshCw } from 'lucide-react';
import Panel from '@/components/Panel';
import { useEngine } from '@/engine/EngineContext';
import { fetchKlines, WS_URL } from '@/lib/bybit';
import { cn } from '@/lib/utils';

const STATUS_TEXT: Record<string, string> = {
  online: 'Подключено к Bybit',
  connecting: 'Подключение…',
  reconnecting: 'Переподключение…',
  offline: 'Нет сети',
};

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function fmtTimeUtcMs(t: number): string {
  const d = new Date(t);
  const base = d.toLocaleTimeString('ru-RU', { hour12: false, timeZone: 'UTC' });
  return `${base}.${String(d.getMilliseconds()).padStart(3, '0')} UTC`;
}

type RestDiag =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'ok'; ms: number; bars: number }
  | { phase: 'fail'; ms: number; message: string };

/** Карточка статуса соединения: пульс, диагностика WS, проверка REST инлайн. */
export default function ConnectionCard() {
  const eng = useEngine();
  const [now, setNow] = useState(() => Date.now());
  const sessionStart = useRef(Date.now());
  const lastTickAt = useRef<number | null>(null);
  const reconnects = useRef(0);
  const prevStatus = useRef(eng.wsStatus);
  const [diag, setDiag] = useState<RestDiag>({ phase: 'idle' });

  // Аптайм сессии — тикает раз в секунду
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Последний тик активного символа
  useEffect(() => {
    if (Number.isFinite(eng.price)) lastTickAt.current = Date.now();
  }, [eng.price]);

  // Счётчик реконнектов
  useEffect(() => {
    if (eng.wsStatus === 'reconnecting' && prevStatus.current !== 'reconnecting') {
      reconnects.current += 1;
    }
    prevStatus.current = eng.wsStatus;
  }, [eng.wsStatus]);

  const topicsCount = eng.symbols.length + 6; // tickers ×N + kline 1/3/5/15/30/60 активного

  const runRestDiag = async () => {
    if (diag.phase === 'running') return;
    setDiag({ phase: 'running' });
    const t0 = performance.now();
    try {
      const bars = await fetchKlines(eng.symbol, '1', 5);
      const ms = performance.now() - t0;
      if (!bars.length) throw new Error('пустой ответ');
      setDiag({ phase: 'ok', ms, bars: bars.length });
    } catch (e) {
      setDiag({
        phase: 'fail',
        ms: performance.now() - t0,
        message: e instanceof Error ? e.message : 'ошибка запроса',
      });
    }
    eng.actions.retryRest();
  };

  const stats: { label: string; value: string }[] = [
    { label: 'аптайм сессии', value: fmtUptime(now - sessionStart.current) },
    { label: 'ping-кадр', value: 'каждые 20 с' },
    {
      label: 'последний тик',
      value: lastTickAt.current ? fmtTimeUtcMs(lastTickAt.current) : '—',
    },
    { label: 'подписки', value: `${topicsCount} топиков` },
    { label: 'реконнектов за сессию', value: String(reconnects.current) },
    { label: 'REST-история', value: eng.restAvailable ? 'доступна' : 'fallback' },
  ];

  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-4">
        {/* Индикатор + состояние */}
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'h-3 w-3 shrink-0 rounded-full',
              eng.wsStatus === 'online' && 'bg-up ws-pulse',
              eng.wsStatus === 'connecting' && 'bg-warn ws-pulse',
              eng.wsStatus === 'reconnecting' && 'bg-warn',
              eng.wsStatus === 'offline' && 'bg-down',
            )}
          />
          <div className="min-w-0">
            <p className="truncate text-[18px] font-semibold text-primary2">
              {STATUS_TEXT[eng.wsStatus]}
            </p>
            <p className="truncate font-mono text-[12px] text-muted2">{WS_URL}</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Действия */}
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={runRestDiag}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-[12px] font-medium text-brand transition-opacity hover:opacity-85"
          >
            {diag.phase === 'running' ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Activity size={13} />
            )}
            Диагностика REST
          </motion.button>
        </div>
      </div>

      {/* Сетка диагностики */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[10px] uppercase tracking-[0.08em] text-faint">{s.label}</p>
            <p className="font-mono text-[12px] text-primary2">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Результат REST-проверки */}
      <AnimatePresence initial={false}>
        {diag.phase !== 'idle' && diag.phase !== 'running' && (
          <motion.div
            key="rest-diag"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {diag.phase === 'ok' ? (
              <p className="mt-3 rounded-lg border border-up/40 bg-up/10 px-3 py-2 font-mono text-[11px] text-up">
                GET /v5/market/kline → 200 OK · {diag.bars} баров за {(diag.ms / 1000).toFixed(1)} с —
                история свечей загружена
              </p>
            ) : (
              <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 font-mono text-[11px] text-warn">
                GET /v5/market/kline → недоступен ({diag.message}) — ожидаемо из части сетей
                (geo-block); история строится из WS
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-3 text-[11px] leading-snug text-faint">
        Переподключение WebSocket — автоматическое, с backoff до 30 с. Пинг измеряется биржевым
        ping-кадром и не выводится в публичный поток.
      </p>
    </Panel>
  );
}
