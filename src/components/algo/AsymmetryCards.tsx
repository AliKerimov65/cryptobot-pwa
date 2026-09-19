import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, Scale } from 'lucide-react';
import { useEngine } from '@/engine/EngineContext';
import { cn } from '@/lib/utils';

interface CardDef {
  key: string;
  icon: typeof TrendingUp;
  title: string;
  text: string;
  tone: 'up' | 'down' | 'neutral';
  activeNow: boolean;
}

/** Объяснительные карточки «как работает асимметрия R190». */
export default function AsymmetryCards() {
  const eng = useEngine();

  const cards: CardDef[] = [
    {
      key: 'up',
      icon: TrendingUp,
      title: 'Тренд вверх · лонг наверху',
      text: 'ADX(14, 1ч) > 25 и +DI выше −DI: лонг-перехватчик вооружается ближе к цене — вход 0.3×stepG вместо 0.5×stepG, чтобы не опоздать к импульсу. Контр-трендовый ШОРТ не вооружается вовсе: ловушка «шорт против потока» снята.',
      tone: 'up',
      activeNow: eng.trendDir === 1,
    },
    {
      key: 'down',
      icon: TrendingDown,
      title: 'Тренд вниз · шорт внизу',
      text: 'Зеркально: при −DI выше +DI шорт-перехватчик встаёт на +0.3×stepG от якоря, а контр-трендовый ЛОНГ отключается. Конвейер не ловит падающие ножи — работает только по направлению потока.',
      tone: 'down',
      activeNow: eng.trendDir === -1,
    },
    {
      key: 'flat',
      icon: Scale,
      title: 'Без тренда · двусторонний режим',
      text: 'Пока ADX ниже 25 (выход из режима — ниже 20, гистерезис) обе стороны вооружены симметрично: ЛОНГ на −0.5×stepG, ШОРТ на +0.5×stepG. Конвейер собирает колебания в обе стороны.',
      tone: 'neutral',
      activeNow: eng.trendDir === 0,
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <motion.div
            key={c.key}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ delay: i * 0.06, duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'rounded-xl border-l-2 p-3',
              c.tone === 'up' && 'border-up bg-up/10',
              c.tone === 'down' && 'border-down bg-down/10',
              c.tone === 'neutral' && 'border-muted2 bg-cardhover/60',
            )}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Icon
                  size={15}
                  strokeWidth={1.75}
                  className={cn(
                    c.tone === 'up' && 'text-up',
                    c.tone === 'down' && 'text-down',
                    c.tone === 'neutral' && 'text-muted2',
                  )}
                />
                <span className="text-[12.5px] font-semibold text-primary2">{c.title}</span>
              </span>
              {c.activeNow && (
                <span className="shrink-0 rounded-full bg-brand/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-brand">
                  сейчас
                </span>
              )}
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted2">{c.text}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
