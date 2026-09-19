import { motion } from 'framer-motion';
import { Info, ShieldAlert } from 'lucide-react';

/** Секция «О зеркале»: честные ограничения v1 + риск-дисклеймер. */
export default function AboutBlock() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="rounded-2xl border border-dashed border-subtle p-4"
    >
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-primary2">
          CryptoBot — зеркало конвейера
        </h2>
        <span className="rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-brand">
          PWA · paper · v1
        </span>
      </header>

      <p className="text-[12.5px] leading-relaxed text-muted2">
        Автономная браузерная копия paper-конвейера Android-приложения CryptoBot. Котировки —
        Bybit WebSocket v5 (публичные топики). Все расчёты выполняются локально, состояние хранится
        в localStorage вашего браузера.
      </p>

      <ul className="mt-3 space-y-1.5 text-[12px] leading-snug text-muted2">
        <li className="flex items-start gap-2">
          <Info size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-faint" />
          Без синхронизации с Android-приложением — нужен relay-сервер (v2)
        </li>
        <li className="flex items-start gap-2">
          <Info size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-faint" />
          Без живой торговли из браузера — приватное API (v2)
        </li>
        <li className="flex items-start gap-2">
          <Info size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-faint" />
          Без совета сонара, эмпирического вето P(BE≤72ч) и сторожа ликвидации (v1.1)
        </li>
        <li className="flex items-start gap-2">
          <Info size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-faint" />
          Комиссии как в приложении: taker 0.068% · maker 0.029% (paper-заполнения — по taker)
        </li>
      </ul>

      <p className="mt-3 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-[11px] leading-snug text-warn">
        <ShieldAlert size={14} strokeWidth={1.75} className="mt-px shrink-0" />
        Paper-торговля. Реальные ордера не выставляются. Это симуляция, а не финансовый совет.
      </p>
    </motion.section>
  );
}
