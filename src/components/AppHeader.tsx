import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useEngine } from '@/engine/EngineContext';
import type { WsStatus } from '@/engine/EngineContext';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const WS_LABEL: Record<WsStatus, string> = {
  connecting: 'подключение…',
  online: 'онлайн',
  reconnecting: 'переподключение…',
  offline: 'офлайн',
};

/** Верхняя плашка: логотип, бейдж, WS-статус, символ-пилюля, «Установить». */
export default function AppHeader() {
  const { wsStatus, symbol } = useEngine();
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-subtle bg-[#0D1017]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4">
        {/* Логотип-глиф + название + бейдж */}
        <div className="flex min-w-0 items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 1.8 21 6.9v10.2l-9 5.1-9-5.1V6.9l9-5.1Z"
              stroke="#6D8DFF"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M13 6.5 8.5 13h3l-1.5 4.5L15.5 11h-3L13 6.5Z" fill="#6D8DFF" />
          </svg>
          <span className="truncate text-[16px] font-semibold tracking-[-0.01em] text-primary2">
            CryptoBot
          </span>
          <span className="hidden shrink-0 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-brand sm:inline">
            PWA · paper
          </span>
        </div>

        <div className="flex-1" />

        {/* WS-статус */}
        <div className="flex items-center gap-1.5" title="Статус WebSocket Bybit">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              wsStatus === 'online' && 'bg-up ws-pulse',
              wsStatus === 'connecting' && 'bg-warn ws-pulse',
              wsStatus === 'reconnecting' && 'bg-warn',
              wsStatus === 'offline' && 'bg-down',
            )}
          />
          <span className="hidden text-[11px] text-muted2 xs:inline sm:inline">
            {WS_LABEL[wsStatus]}
          </span>
        </div>

        {/* Символ-пилюля */}
        <span className="rounded-full border border-subtle bg-cardbg px-2.5 py-1 font-mono text-[11px] font-medium text-primary2">
          {symbol}
        </span>

        {/* Установить (beforeinstallprompt) */}
        {installEvt && (
          <button
            type="button"
            onClick={async () => {
              await installEvt.prompt();
              const choice = await installEvt.userChoice;
              if (choice.outcome === 'accepted') setInstallEvt(null);
            }}
            className="cursor-pointer rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-[#0B0E14] transition-opacity hover:opacity-90"
          >
            Установить
          </button>
        )}
      </div>
    </header>
  );
}
