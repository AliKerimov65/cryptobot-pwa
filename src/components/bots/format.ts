/** Форматтеры чисел страницы «Боты» (ru-RU, mono/tabular-nums). */

export function fmtUsd(n: number, digits = 2): string {
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtSigned(n: number, digits = 2): string {
  const s = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${s}${fmtUsd(Math.abs(n), digits)}`;
}

/** Цена инструмента: 1 знак после запятой для крупных, 2–4 для мелких. */
export function fmtPrice(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const digits = n >= 1000 ? 1 : n >= 100 ? 2 : 4;
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(frac: number, digits = 2): string {
  return `${(frac * 100).toFixed(digits).replace('.', ',')}%`;
}

/** Разбор числа из ru-строки журнала: «67 120,5» (с NBSP) → 67120.5. */
export function parseRuNum(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}
