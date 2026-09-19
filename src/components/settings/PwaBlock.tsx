import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Smartphone } from 'lucide-react';
import Panel from '@/components/Panel';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Захардкоженная версия кэша оболочки — из public/sw.js (CACHE = 'cryptobot-shell-v1'). */
const SW_CACHE_LABEL = 'sw v1 · cryptobot-shell-v1';

function Row({
  title,
  hint,
  children,
  index,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2, ease: 'easeOut' }}
      className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1A2030] py-3 last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-primary2">{title}</p>
        {hint != null && <p className="mt-0.5 text-[11px] leading-snug text-faint">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </motion.div>
  );
}

/** Секция «Приложение (PWA)»: установка, кэш оболочки, версия. */
export default function PwaBlock() {
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const clearCache = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      setCleared(true);
      setTimeout(() => window.location.reload(), 700);
    } catch {
      setClearing(false);
    }
  };

  return (
    <Panel title="Приложение (PWA)">
      <Row
        index={0}
        title="Установить на рабочий стол"
        hint={
          installEvt
            ? 'Автономное окно, иконка на главном экране, офлайн-оболочка'
            : 'Если кнопки нет: меню браузера → «Добавить на главный экран»'
        }
      >
        {installEvt ? (
          <button
            type="button"
            onClick={async () => {
              await installEvt.prompt();
              const choice = await installEvt.userChoice;
              if (choice.outcome === 'accepted') setInstallEvt(null);
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-[#0B0E14] transition-opacity hover:opacity-90"
          >
            <Smartphone size={14} strokeWidth={2} />
            Установить
          </button>
        ) : (
          <span className="rounded-full border border-subtle bg-cardbg px-2.5 py-1 text-[11px] text-faint">
            установка из меню браузера
          </span>
        )}
      </Row>

      <Row index={1} title="Кэш офлайн-оболочки" hint="Service worker держит статику оболочки для запуска без сети">
        <span className="rounded-full border border-up/40 bg-up/10 px-2.5 py-1 font-mono text-[11px] font-medium text-up">
          {SW_CACHE_LABEL}
        </span>
      </Row>

      <Row
        index={2}
        title="Очистить кэш оболочки"
        hint="Удаляет SW-кэш и перезагружает приложение; paper-данные в localStorage не затрагиваются"
      >
        <button
          type="button"
          onClick={clearCache}
          disabled={clearing}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:cursor-wait',
            cleared
              ? 'border-up/50 bg-up/10 text-up'
              : 'border-subtle bg-cardbg text-muted2 hover:text-primary2',
          )}
        >
          <RefreshCw size={14} strokeWidth={2} className={cn(clearing && !cleared && 'animate-spin')} />
          {cleared ? 'Очищено · перезагрузка…' : 'Очистить кэш'}
        </button>
      </Row>

      <Row index={3} title="Версия">
        <span className="font-mono text-[11px] text-muted2">
          зеркало v1.0 · paper-движок v1 · Bybit v5 public
        </span>
      </Row>
    </Panel>
  );
}
