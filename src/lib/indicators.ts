/**
 * Технические индикаторы на массивах свечей {t,o,h,l,c,v}.
 * Все функции возвращают массивы той же длины, что и вход; период разогрева — NaN.
 * Сглаживание — по Уайлдеру (как в боевом приложении).
 */
import type { Candle } from '@/lib/bybit';

/** Последнее конечное значение массива (или NaN). */
export function lastVal(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(arr[i])) return arr[i];
  }
  return NaN;
}

/** EMA по массиву значений. */
export function ema(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i += 1) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** ATR(period) по Уайлдеру. */
export function atr(candles: Candle[], period = 14): number[] {
  const out = new Array<number>(candles.length).fill(NaN);
  if (candles.length < period + 1) return out;
  const trs = new Array<number>(candles.length).fill(NaN);
  for (let i = 1; i < candles.length; i += 1) {
    const { h, l } = candles[i];
    const pc = candles[i - 1].c;
    trs[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  let sum = 0;
  for (let i = 1; i <= period; i += 1) sum += trs[i];
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < candles.length; i += 1) {
    prev = (prev * (period - 1) + trs[i]) / period;
    out[i] = prev;
  }
  return out;
}

/** RSI(period) по Уайлдеру. */
export function rsi(closes: number[], period = 14): number[] {
  const out = new Array<number>(closes.length).fill(NaN);
  if (closes.length < period + 1) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i += 1) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface AdxResult {
  adx: number[];
  pdi: number[];
  ndi: number[];
}

/** ADX(period) с +DI/−DI по Уайлдеру. */
export function adx(candles: Candle[], period = 14): AdxResult {
  const n = candles.length;
  const adxArr = new Array<number>(n).fill(NaN);
  const pdiArr = new Array<number>(n).fill(NaN);
  const ndiArr = new Array<number>(n).fill(NaN);
  if (n < period * 2 + 1) return { adx: adxArr, pdi: pdiArr, ndi: ndiArr };

  const tr = new Array<number>(n).fill(0);
  const pdm = new Array<number>(n).fill(0);
  const ndm = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i += 1) {
    const { h, l } = candles[i];
    const ph = candles[i - 1].h;
    const pl = candles[i - 1].l;
    const pc = candles[i - 1].c;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    const up = h - ph;
    const dn = pl - l;
    pdm[i] = up > dn && up > 0 ? up : 0;
    ndm[i] = dn > up && dn > 0 ? dn : 0;
  }

  let trS = 0;
  let pdmS = 0;
  let ndmS = 0;
  for (let i = 1; i <= period; i += 1) {
    trS += tr[i];
    pdmS += pdm[i];
    ndmS += ndm[i];
  }
  const dx = new Array<number>(n).fill(NaN);
  for (let i = period; i < n; i += 1) {
    if (i > period) {
      trS = trS - trS / period + tr[i];
      pdmS = pdmS - pdmS / period + pdm[i];
      ndmS = ndmS - ndmS / period + ndm[i];
    }
    const pdi = trS === 0 ? 0 : (100 * pdmS) / trS;
    const ndi = trS === 0 ? 0 : (100 * ndmS) / trS;
    pdiArr[i] = pdi;
    ndiArr[i] = ndi;
    const sum = pdi + ndi;
    dx[i] = sum === 0 ? 0 : (100 * Math.abs(pdi - ndi)) / sum;
  }

  // ADX — сглаженное DX
  let sumDx = 0;
  const start = period * 2 - 1;
  for (let i = period; i <= start; i += 1) sumDx += dx[i];
  let prev = sumDx / period;
  adxArr[start] = prev;
  for (let i = start + 1; i < n; i += 1) {
    prev = (prev * (period - 1) + dx[i]) / period;
    adxArr[i] = prev;
  }
  return { adx: adxArr, pdi: pdiArr, ndi: ndiArr };
}
