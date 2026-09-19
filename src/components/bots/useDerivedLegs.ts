import { useMemo } from 'react';
import type { JournalEntry } from '@/engine/EngineContext';
import { utcDayKey } from '@/engine/conveyor';
import { parseRuNum } from './format';

/**
 * Восстановление открытых ног сторон из журнала событий.
 * EngineContext не отдаёт детали legs (только счётчики), поэтому детализация
 * карточки бота (средняя цена, номинал, плавающий по стороне, сутки по стороне)
 * честно выводится из собственных записей движка:
 *   вход:  «⚡ Перехватчик ЛОНГ исполнен @ 67 120,5 · ТР 67 405,2 · номинал 201,4 USDT»
 *   выход: «✅ ТР ЛОНГ @ 67 405,2 · нетто +2,87 USDT» (связываем по стороне + цене ТР)
 *   сброс: «♻️ …» обнуляет реконструкцию.
 * Журнал хранит ≤200 записей: при обрезании истории блок показывает то, что удалось
 * восстановить (счётчики Л/Ш в карточке всегда берутся из контекста движка).
 */

export interface DerivedLeg {
  side: 'L' | 'S';
  entry: number;
  tp: number;
  notional: number;
  openTime: number;
}

export interface SideAggregate {
  count: number;
  avgEntry: number; // взвешенная по номиналу
  notional: number;
  floatingGross: number; // (price − entry) × qty × dir, без комиссии выхода
  dayRealized: number; // реализовано за текущие UTC-сутки по закрытиям журнала
}

const ENTRY_RE = /Перехватчик (ЛОНГ|ШОРТ) исполнен @ ([\d\s,]+) · ТР ([\d\s,]+) · номинал ([\d\s,]+) USDT/;
const CLOSE_RE = /ТР (ЛОНГ|ШОРТ) @ ([\d\s,]+) · нетто ([+−-]?[\d\s,]+) USDT/;

export interface DerivedResult {
  legs: DerivedLeg[];
  long: SideAggregate;
  short: SideAggregate;
}

function emptySide(): SideAggregate {
  return { count: 0, avgEntry: NaN, notional: 0, floatingGross: 0, dayRealized: 0 };
}

export function useDerivedLegs(journal: JournalEntry[], price: number): DerivedResult {
  return useMemo(() => {
    const legs: DerivedLeg[] = [];
    let dayL = 0;
    let dayS = 0;
    const today = utcDayKey();

    // журнал приходит новыми первыми — идём от старых к новым
    const chronological = [...journal].reverse();
    for (const e of chronological) {
      if (e.icon === '♻️') {
        legs.length = 0;
        continue;
      }
      const entry = ENTRY_RE.exec(e.text);
      if (entry) {
        legs.push({
          side: entry[1] === 'ЛОНГ' ? 'L' : 'S',
          entry: parseRuNum(entry[2]),
          tp: parseRuNum(entry[3]),
          notional: parseRuNum(entry[4]),
          openTime: e.t,
        });
        continue;
      }
      const close = CLOSE_RE.exec(e.text);
      if (close) {
        const side = close[1] === 'ЛОНГ' ? 'L' : 'S';
        const tp = parseRuNum(close[2]);
        const net = parseRuNum(close[3]);
        // связываем закрытие с ногой по стороне и цене ТР (точное совпадение формата)
        const idx = legs.findIndex((l) => l.side === side && Math.abs(l.tp - tp) < 1e-9);
        if (idx >= 0) legs.splice(idx, 1);
        if (utcDayKey(e.t) === today && Number.isFinite(net)) {
          if (side === 'L') dayL += net;
          else dayS += net;
        }
      }
    }

    const agg = (side: 'L' | 'S', day: number): SideAggregate => {
      const list = legs.filter((l) => l.side === side);
      if (!list.length) return { ...emptySide(), dayRealized: day };
      const notional = list.reduce((s, l) => s + l.notional, 0);
      const avgEntry = list.reduce((s, l) => s + l.entry * l.notional, 0) / (notional || 1);
      let floatingGross = 0;
      const dir = side === 'L' ? 1 : -1;
      if (Number.isFinite(price)) {
        floatingGross = list.reduce(
          (s, l) => s + (price - l.entry) * (l.notional / l.entry) * dir,
          0,
        );
      }
      return {
        count: list.length,
        avgEntry,
        notional,
        floatingGross,
        dayRealized: day,
      };
    };

    return { legs, long: agg('L', dayL), short: agg('S', dayS) };
  }, [journal, price]);
}
