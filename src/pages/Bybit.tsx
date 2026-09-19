import { AnimatePresence, motion } from 'framer-motion';
import { Info, KeyRound, Wifi } from 'lucide-react';
import { useEngine } from '@/engine/EngineContext';
import StatusBanner from '@/components/StatusBanner';
import OfflineScreen from '@/components/OfflineScreen';
import ConnectionCard from '@/components/bybit/ConnectionCard';
import LiveTicker from '@/components/bybit/LiveTicker';
import SymbolsTable from '@/components/bybit/SymbolsTable';
import StreamTerminal from '@/components/bybit/StreamTerminal';

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: 'easeOut' as const },
};

export default function Bybit() {
  const eng = useEngine();

  // Офлайн: весь раздел заменяется честным экраном
  if (!eng.online) {
    return <OfflineScreen onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-3">
      {/* Заголовок */}
      <motion.div {...fadeUp}>
        <h1 className="flex items-center gap-2 text-[28px] font-bold tracking-[-0.01em] text-primary2">
          <Wifi size={24} className="text-brand" />
          Bybit
        </h1>
        <p className="mt-0.5 text-[12px] text-muted2">
          Соединение с биржей · публичный WebSocket v5 · без ключей API
        </p>
      </motion.div>

      {/* Баннеры состояния */}
      <AnimatePresence>
        {!eng.restAvailable && (
          <StatusBanner
            key="rest"
            variant="warn"
            text="История свечей недоступна из вашей сети — накапливаем онлайн через WebSocket"
            actionLabel="Повторить"
            onAction={() => eng.actions.retryRest()}
          />
        )}
        {eng.wsStatus === 'reconnecting' && (
          <StatusBanner
            key="ws-re"
            variant="neutral"
            text="Переподключаемся к Bybit WebSocket…"
          />
        )}
        {eng.wsStatus === 'offline' && (
          <StatusBanner
            key="ws-off"
            variant="short"
            text="Соединение с Bybit разорвано — живая лента остановлена"
            actionLabel="Повторить"
            onAction={() => window.location.reload()}
          />
        )}
      </AnimatePresence>

      {/* 1. Статус соединения */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }}>
        <ConnectionCard />
      </motion.div>

      {/* 2. Живой тикер */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
        <LiveTicker />
      </motion.div>

      {/* 3. Таблица наблюдаемых символов */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}>
        <SymbolsTable />
      </motion.div>

      {/* 4. Терминал потока */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}>
        <StreamTerminal />
      </motion.div>

      {/* 5. Политика доступа к данным */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.3, once: true }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="rounded-2xl border border-dashed border-subtle bg-cardbg/50 p-4"
      >
        <div className="flex items-start gap-2.5">
          <Info size={15} className="mt-0.5 shrink-0 text-brand" />
          <p className="text-[12px] leading-relaxed text-muted2">
            WebSocket — основной канал, не подчиняется CORS. REST-история свечей из браузера не
            гарантирована (geo-block отдельных сетей): при недоступности показываем баннер и
            накапливаем историю онлайн.
          </p>
        </div>
        <div className="mt-2.5 flex items-start gap-2.5 border-t border-dashed border-subtle pt-2.5">
          <KeyRound size={15} className="mt-0.5 shrink-0 text-warn" />
          <p className="text-[12px] leading-relaxed text-muted2">
            Ключи API в v1 не запрашиваются — приватное API и живая торговля из браузера
            запланированы в дорожной карте v2.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
