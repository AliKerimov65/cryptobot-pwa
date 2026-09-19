import { motion } from 'framer-motion';
import { Map } from 'lucide-react';
import Panel from '@/components/Panel';
import PipelineDiagram from '@/components/algo/PipelineDiagram';
import LiveParams from '@/components/algo/LiveParams';
import LevelsVisualizer from '@/components/algo/LevelsVisualizer';
import SignalFeed from '@/components/algo/SignalFeed';
import AsymmetryCards from '@/components/algo/AsymmetryCards';

const SUBTITLE =
  'Пайплайн paper-конвейера: якорь → шаг → перехватчик → нога → тейк. Все вычисления — локально, в браузере.';

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18, ease: 'easeOut' as const },
};

export default function AlgoTrading() {
  return (
    <div className="space-y-3">
      {/* 1. Заголовок раздела */}
      <div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="text-[28px] font-bold tracking-[-0.01em] text-primary2"
        >
          AlgoTrading
        </motion.h1>
        <p className="mt-1 max-w-[640px] text-[14px] leading-snug text-muted2">
          {SUBTITLE.split(' ').map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.3, ease: 'easeOut' }}
              className="inline-block"
            >
              {word}
              {i < SUBTITLE.split(' ').length - 1 ? ' ' : ''}
            </motion.span>
          ))}
        </p>
      </div>

      {/* 2. Интерактивная схема конвейера */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }}>
        <Panel title="Схема конвейера">
          <PipelineDiagram />
        </Panel>
      </motion.div>

      {/* 3. Живые параметры движка */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
        <Panel title="Живые параметры движка">
          <LiveParams />
        </Panel>
      </motion.div>

      {/* 4. Визуализатор «Якорь и уровни» */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}>
        <Panel title="Якорь и уровни">
          <LevelsVisualizer />
        </Panel>
      </motion.div>

      {/* 5. Лента сигналов конвейера */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}>
        <Panel title="Сигналы">
          <SignalFeed />
        </Panel>
      </motion.div>

      {/* 6. Как работает асимметрия R190 */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.25 }}>
        <Panel title="Как работает асимметрия R190">
          <AsymmetryCards />
        </Panel>
      </motion.div>

      {/* 7. Чего нет в v1 */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.3 }}
        className="flex items-start gap-2.5 rounded-2xl border border-dashed border-subtle p-4"
      >
        <Map size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warn" />
        <p className="text-[12.5px] leading-relaxed text-muted2">
          <span className="font-semibold text-primary2">Чего нет в v1. </span>
          Совет сонара (5 голосов) и эмпирическое вето P(BE≤72ч) — v1.1+ · сторож ликвидации —
          v1.1+ · синхронизация с Android — v2.
        </p>
      </motion.div>
    </div>
  );
}
