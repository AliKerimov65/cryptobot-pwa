import { motion } from 'framer-motion';
import ConveyorParams from '@/components/settings/ConveyorParams';
import SymbolPicker from '@/components/settings/SymbolPicker';
import PwaBlock from '@/components/settings/PwaBlock';
import DataBlock from '@/components/settings/DataBlock';
import AboutBlock from '@/components/settings/AboutBlock';

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18, ease: 'easeOut' as const },
};

export default function Settings() {
  return (
    <div className="space-y-3">
      <div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="text-[28px] font-bold tracking-[-0.01em] text-primary2"
        >
          Настройки
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
          className="mt-1 max-w-[640px] text-[14px] leading-snug text-muted2"
        >
          Параметры paper-конвейера, символ, PWA-оболочка и данные. Сохранение — мгновенно, в
          localStorage браузера.
        </motion.p>
      </div>

      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }}>
        <ConveyorParams />
      </motion.div>

      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
        <SymbolPicker />
      </motion.div>

      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}>
        <PwaBlock />
      </motion.div>

      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}>
        <DataBlock />
      </motion.div>

      <AboutBlock />
    </div>
  );
}
