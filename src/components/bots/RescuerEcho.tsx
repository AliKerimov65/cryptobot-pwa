import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

/**
 * «Спасатель» — визуальное эхо монитора Android-версии (v1: статичная плашка,
 * PHS не вычисляется; полный порт логики — в дорожной карте v1.1).
 * Статус «тревожно» 39/100: шкала 0→39% 600ms easeOut, мягкий пульс рамки warn.
 */
export default function RescuerEcho() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="rounded-xl border border-subtle p-3"
    >
      <motion.div
        className="rounded-lg"
        animate={{ boxShadow: [
          '0 0 0 1px rgb(251 191 36 / 0.10)',
          '0 0 0 1px rgb(251 191 36 / 0.45)',
          '0 0 0 1px rgb(251 191 36 / 0.10)',
        ] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="p-1">
          <div className="mb-2 flex items-center gap-2">
            <Shield size={15} className="shrink-0 text-warn" aria-hidden />
            <span className="text-[13px] font-medium text-primary2">
              Спасатель · здоровье <span className="font-mono font-semibold text-warn">39/100</span>
              {' '}· <span className="font-semibold text-warn">тревожно</span>
            </span>
          </div>
          {/* шкала здоровья: ok → критично */}
          <div className="h-1 overflow-hidden rounded-full bg-[#1A2030]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '39%' }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #34D399 0%, #FBBF24 55%, #FB923C 80%, #F87171 100%)',
              }}
            />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-faint">
            визуальное эхо Android-версии — полный порт в дорожной карте v1.1
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
