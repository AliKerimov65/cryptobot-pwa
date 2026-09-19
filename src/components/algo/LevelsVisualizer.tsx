import { useEffect, useMemo } from 'react';
import { motion, useSpring } from 'framer-motion';
import { useEngine } from '@/engine/EngineContext';

const W = 560;
const H = 220;
const PAD_X = 8;
const PAD_Y = 18;
const PILL_ZONE = 96; // справа — место под пилюлю цены

interface Level {
  key: string;
  price: number;
  color: string;
  dash?: string;
  width: number;
  label: string;
  armed?: boolean;
}

function fmt(n: number, digits = 1): string {
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** SVG-визуализатор уровней: якорь, входы перехватчиков L/S, уровни ТР, метка цены. */
export default function LevelsVisualizer() {
  const eng = useEngine();

  const model = useMemo(() => {
    if (eng.anchor == null || !Number.isFinite(eng.anchor)) return null;
    const anchor = eng.anchor;
    const stepG = eng.stepG;
    const mult = eng.trendDir !== 0 ? 0.3 : 0.5;
    const canArm = (side: 'L' | 'S') =>
      eng.trendDir === 0 || (side === 'L' && eng.trendDir === 1) || (side === 'S' && eng.trendDir === -1);

    const entryL = eng.pendingL ?? (canArm('L') ? anchor * (1 - mult * stepG) : null);
    const entryS = eng.pendingS ?? (canArm('S') ? anchor * (1 + mult * stepG) : null);

    const levels: Level[] = [
      { key: 'anchor', price: anchor, color: '#6D8DFF', width: 1.5, label: 'Якорь' },
    ];
    if (entryL != null) {
      levels.push({
        key: 'entryL', price: entryL, color: '#34D399', dash: '6 4', width: 1.25,
        label: `Вход ЛОНГ −${mult.toFixed(1)}×stepG`, armed: eng.pendingL != null,
      });
      levels.push({
        key: 'tpL', price: entryL * (1 + stepG), color: '#34D399', dash: '2 4', width: 1,
        label: 'ТР ЛОНГ +1.0×stepG',
      });
    }
    if (entryS != null) {
      levels.push({
        key: 'entryS', price: entryS, color: '#F87171', dash: '6 4', width: 1.25,
        label: `Вход ШОРТ +${mult.toFixed(1)}×stepG`, armed: eng.pendingS != null,
      });
      levels.push({
        key: 'tpS', price: entryS * (1 - stepG), color: '#F87171', dash: '2 4', width: 1,
        label: 'ТР ШОРТ −1.0×stepG',
      });
    }

    const pts = levels.map((l) => l.price);
    if (Number.isFinite(eng.price)) pts.push(eng.price);
    let min = Math.min(...pts);
    let max = Math.max(...pts);
    const minSpan = anchor * stepG * 2.4;
    if (max - min < minSpan) {
      const c = (max + min) / 2;
      min = c - minSpan / 2;
      max = c + minSpan / 2;
    }
    const pad = (max - min) * 0.08;
    min -= pad;
    max += pad;

    const y = (p: number) => PAD_Y + ((max - p) / (max - min)) * (H - 2 * PAD_Y);
    return { levels, y, min, max };
  }, [eng.anchor, eng.stepG, eng.trendDir, eng.pendingL, eng.pendingS, eng.price]);

  // Пилюля цены: spring-скольжение при тиках
  const priceY = model && Number.isFinite(eng.price) ? model.y(eng.price) : H / 2;
  const ySpring = useSpring(priceY, { stiffness: 120, damping: 20 });
  useEffect(() => {
    ySpring.set(priceY);
  }, [priceY, ySpring]);

  if (!model) {
    return (
      <div className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-subtle">
        <p className="text-[13px] text-muted2">Якорь появится после запуска конвейера</p>
        <p className="text-[11px] text-faint">Запустите paper-конвейер на «Главной» — уровни построятся от цены старта</p>
      </div>
    );
  }

  const { levels, y } = model;

  return (
    <div className="relative">
      <span className="absolute right-1 top-0 z-10 rounded-full border border-subtle bg-cardbg px-2 py-0.5 text-[10px] text-faint">
        схематично · масштаб stepG
      </span>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Уровни цены конвейера">
        {/* вертикальная шкала */}
        <line x1={PAD_X} y1={PAD_Y - 6} x2={PAD_X} y2={H - PAD_Y + 6} stroke="#1C2230" strokeWidth="1" />
        {levels.map((l) => {
          const yy = y(l.price);
          return (
            <g key={l.key}>
              <motion.line
                x1={PAD_X}
                x2={W - PILL_ZONE}
                stroke={l.color}
                strokeWidth={l.width}
                strokeDasharray={l.dash}
                initial={false}
                animate={{ y1: yy, y2: yy, opacity: l.armed === false ? 0.45 : 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
              <motion.g initial={false} animate={{ y: yy }} transition={{ duration: 0.3, ease: 'easeOut' }}>
                <text x={PAD_X + 4} y={-4} fill={l.color} fontSize="10" fontFamily="JetBrains Mono, monospace">
                  {l.label}
                </text>
                <text
                  x={W - PILL_ZONE - 4}
                  y={-4}
                  textAnchor="end"
                  fill="#8B93A7"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {fmt(l.price)}
                </text>
              </motion.g>
            </g>
          );
        })}
      </svg>

      {/* Пилюля текущей цены */}
      {Number.isFinite(eng.price) && (
        <motion.div
          className="pointer-events-none absolute right-1 top-0 flex items-center gap-1.5"
          style={{ y: ySpring }}
        >
          <span className="h-px w-3 bg-primary2/60" style={{ transform: 'translateY(-9px)' }} />
          <span
            className="rounded-full border border-primary2/40 bg-[#1A1F2B] px-2 py-0.5 font-mono text-[11px] font-semibold text-primary2"
            style={{ transform: 'translateY(-11px)' }}
          >
            {fmt(eng.price)}
          </span>
        </motion.div>
      )}

      {/* Легенда */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-faint">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-[1.5px] border-brand" /> якорь
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t border-dashed border-up" /> вход ЛОНГ
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t border-dashed border-down" /> вход ШОРТ
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t border-dotted border-muted2" /> тейк ±1.0×stepG
        </span>
      </div>
    </div>
  );
}
