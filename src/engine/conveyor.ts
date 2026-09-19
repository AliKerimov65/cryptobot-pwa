/**
 * Paper-порт движка конвейера CryptoBot (контракты из info.md — без выдумок):
 *  - stepG = clamp(k × ATR(14, 15м) как доля цены, 0.0015, 0.02); k = 0.5 (дефолт).
 *  - Якорь — цена старта конвейера; пересчёт шага периодический + при смене тренд-режима.
 *  - Перехватчик: половина ноги, вход ∓0.5×stepG от якоря, TP ±1.0×stepG от входа.
 *  - R190 асимметрия: при trendDir≠0 (ADX(14,1ч)>25 + DI, выход из режима при ADX<20)
 *    контр-трендовый перехватчик НЕ вооружается; про-трендовый вход ближе — 0.3×stepG.
 *  - Нога: маржа = 1.5% эквити, плечо 5x (номинал = маржа × плечо), мин. номинал 5 USDT.
 *  - Комиссия taker 0.068% на вход и на выход (paper-заполнения).
 *  - Эквити старт 1000 USDT; эквити = кэш + реализ. − комиссии; плавающий — онлайн по тикеру.
 *  - Исполнение — касанием цены (high/low свечи 1м, между свечами — тикер).
 *  - Ликвидация в paper v1 не моделируется.
 */
import type { Candle } from '@/lib/bybit';
import { adx, atr, lastVal } from '@/lib/indicators';

export type Side = 'L' | 'S';
export type TrendDir = -1 | 0 | 1;

export const TAKER_FEE = 0.00068; // 0.068% боевые константы приложения
export const MIN_NOTIONAL = 5; // минимальный номинал ордера Bybit, USDT
export const START_EQUITY = 1000;
export const STEP_MIN = 0.0015;
export const STEP_MAX = 0.02;
export const ADX_ENTER = 25; // вход в тренд-режим
export const ADX_EXIT = 20; // выход (гистерезис)

export interface Leg {
  id: number;
  side: Side;
  entry: number;
  tp: number;
  qty: number; // в базовом актиve
  notional: number; // USDT
  margin: number; // USDT
  entryFee: number; // USDT, уже списана
  openTime: number;
  catcher: boolean; // перехватчик (половина ноги)
}

export interface PendingCatcher {
  side: Side;
  price: number;
  armed: boolean;
}

export interface JournalEntry {
  id: number;
  t: number; // ms
  icon: string; // эмодзи-маркер: 🧭 ⚡ ✅ 🛡 🚫 ▶️ ⏸ ♻️
  text: string;
}

export interface SideStats {
  trades: number;
  wins: number;
  realized: number;
}

export interface EngineParams {
  k: number;
  leverage: number;
  legEquityPct: number; // доля эквити на маржу ноги (0.015)
}

export const DEFAULT_PARAMS: EngineParams = { k: 0.5, leverage: 5, legEquityPct: 0.015 };

export interface PersistedEngine {
  cash: number;
  anchor: number | null;
  stepG: number;
  running: boolean;
  params: EngineParams;
  symbol: string;
  legs: Leg[];
  pendings: PendingCatcher[];
  journal: JournalEntry[];
  statsL: SideStats;
  statsS: SideStats;
  trades: number;
  wins: number;
  dayKey: string;
  dayRealized: number;
  peakEquity: number;
  maxDD: number;
  equityCurve: number[];
  trendDir: TrendDir;
  nextId: number;
}

export function utcDayKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function fmtNum(n: number, digits = 2): string {
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export class Conveyor {
  cash = START_EQUITY;
  anchor: number | null = null;
  stepG = 0.003;
  running = false;
  params: EngineParams = { ...DEFAULT_PARAMS };
  symbol: string;
  legs: Leg[] = [];
  pendings: PendingCatcher[] = [];
  journal: JournalEntry[] = [];
  statsL: SideStats = { trades: 0, wins: 0, realized: 0 };
  statsS: SideStats = { trades: 0, wins: 0, realized: 0 };
  trades = 0;
  wins = 0;
  dayKey = utcDayKey();
  dayRealized = 0;
  peakEquity = START_EQUITY;
  maxDD = 0; // доля от пика
  equityCurve: number[] = [];
  trendDir: TrendDir = 0;
  adx = NaN;
  pdi = NaN;
  ndi = NaN;
  private nextId = 1;
  private onEvent: () => void;

  constructor(symbol: string, onEvent: () => void = () => {}) {
    this.symbol = symbol;
    this.onEvent = onEvent;
  }

  /* ---------------- persistence ---------------- */

  serialize(): PersistedEngine {
    return {
      cash: this.cash,
      anchor: this.anchor,
      stepG: this.stepG,
      running: this.running,
      params: this.params,
      symbol: this.symbol,
      legs: this.legs,
      pendings: this.pendings,
      journal: this.journal.slice(0, 200),
      statsL: this.statsL,
      statsS: this.statsS,
      trades: this.trades,
      wins: this.wins,
      dayKey: this.dayKey,
      dayRealized: this.dayRealized,
      peakEquity: this.peakEquity,
      maxDD: this.maxDD,
      equityCurve: this.equityCurve.slice(-240),
      trendDir: this.trendDir,
      nextId: this.nextId,
    };
  }

  hydrate(p: PersistedEngine) {
    this.cash = p.cash;
    this.anchor = p.anchor;
    this.stepG = p.stepG;
    this.running = p.running;
    this.params = { ...DEFAULT_PARAMS, ...p.params };
    this.symbol = p.symbol;
    this.legs = p.legs ?? [];
    this.pendings = p.pendings ?? [];
    this.journal = p.journal ?? [];
    this.statsL = p.statsL ?? { trades: 0, wins: 0, realized: 0 };
    this.statsS = p.statsS ?? { trades: 0, wins: 0, realized: 0 };
    this.trades = p.trades ?? 0;
    this.wins = p.wins ?? 0;
    this.dayKey = p.dayKey ?? utcDayKey();
    this.dayRealized = p.dayRealized ?? 0;
    this.peakEquity = p.peakEquity ?? START_EQUITY;
    this.maxDD = p.maxDD ?? 0;
    this.equityCurve = p.equityCurve ?? [];
    this.trendDir = p.trendDir ?? 0;
    this.nextId = p.nextId ?? 1;
  }

  /* ---------------- журнал ---------------- */

  log(icon: string, text: string) {
    this.journal.unshift({ id: this.nextId++, t: Date.now(), icon, text });
    if (this.journal.length > 200) this.journal.length = 200;
    this.onEvent();
  }

  /* ---------------- учёт ---------------- */

  private cashDelta(delta: number, ts = Date.now()) {
    const key = utcDayKey(ts);
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.dayRealized = 0;
    }
    this.cash += delta;
    this.dayRealized += delta;
  }

  floatingAt(price: number): number {
    let sum = 0;
    for (const leg of this.legs) {
      const dir = leg.side === 'L' ? 1 : -1;
      const gross = (price - leg.entry) * leg.qty * dir;
      const exitFee = Math.abs(price * leg.qty) * TAKER_FEE;
      sum += gross - exitFee;
    }
    return sum;
  }

  equityAt(price: number): number {
    return this.cash + this.floatingAt(price);
  }

  trackEquity(price: number) {
    const eq = this.equityAt(price);
    if (eq > this.peakEquity) this.peakEquity = eq;
    if (this.peakEquity > 0) {
      const dd = (this.peakEquity - eq) / this.peakEquity;
      if (dd > this.maxDD) this.maxDD = dd;
    }
    const curve = this.equityCurve;
    if (!curve.length || Math.abs(curve[curve.length - 1] - eq) > 1e-9) {
      curve.push(eq);
      if (curve.length > 240) curve.shift();
    }
  }

  /* ---------------- управление ---------------- */

  start(price: number) {
    if (this.running) return;
    this.running = true;
    if (this.anchor == null) {
      this.anchor = price;
      this.log('▶️', `Конвейер запущен · якорь ${fmtNum(price, 1)} · шаг ${(this.stepG * 100).toFixed(2)}%`);
    } else {
      this.log('▶️', 'Конвейер возобновлён');
    }
    this.armCatchers();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.pendings = this.pendings.map((p) => ({ ...p, armed: false }));
    this.log('⏸', 'Конвейер остановлен · ждущие перехватчики сняты, открытые ноги работают до ТР');
  }

  reset() {
    const sym = this.symbol;
    const params = { ...this.params };
    this.cash = START_EQUITY;
    this.anchor = null;
    this.stepG = 0.003;
    this.running = false;
    this.legs = [];
    this.pendings = [];
    this.statsL = { trades: 0, wins: 0, realized: 0 };
    this.statsS = { trades: 0, wins: 0, realized: 0 };
    this.trades = 0;
    this.wins = 0;
    this.dayRealized = 0;
    this.dayKey = utcDayKey();
    this.peakEquity = START_EQUITY;
    this.maxDD = 0;
    this.equityCurve = [];
    this.trendDir = 0;
    this.symbol = sym;
    this.params = params;
    this.log('♻️', `Paper-порт сброшен · эквити ${fmtNum(START_EQUITY, 0)} USDT`);
  }

  setParams(p: Partial<EngineParams>) {
    this.params = { ...this.params, ...p };
    this.log(
      '⚙️',
      `Параметры: k=${this.params.k} · плечо ${this.params.leverage}x · нога ${(this.params.legEquityPct * 100).toFixed(1)}% эквити`,
    );
    if (this.anchor != null) this.armCatchers();
  }

  /* ---------------- шаг и тренд ---------------- */

  /** Периодический пересчёт шага по ATR(14, 15м). */
  onCandles15m(candles: Candle[], price: number) {
    if (candles.length < 16 || price <= 0) return;
    const a = lastVal(atr(candles, 14));
    if (!Number.isFinite(a)) return;
    const next = Math.min(Math.max((this.params.k * a) / price, STEP_MIN), STEP_MAX);
    if (Math.abs(next - this.stepG) / this.stepG > 0.02) {
      const old = this.stepG;
      this.stepG = next;
      if (this.running) {
        this.log(
          '🧭',
          `Шаг пересчитан: ${(old * 100).toFixed(2)}% → ${(next * 100).toFixed(2)}% (ATR 15м)`,
        );
        this.armCatchers();
      } else {
        this.stepG = next;
      }
    }
  }

  /** Тренд-режим R190 по ADX(14, 1ч) с гистерезисом: вход ADX>25, выход ADX<20. */
  onCandles1h(candles: Candle[]) {
    if (candles.length < 30) return;
    const r = adx(candles, 14);
    const a = lastVal(r.adx);
    const p = lastVal(r.pdi);
    const n = lastVal(r.ndi);
    if (!Number.isFinite(a)) return;
    const prevDir = this.trendDir;
    this.adx = a;
    this.pdi = p;
    this.ndi = n;

    if (this.trendDir === 0 && a > ADX_ENTER) {
      this.trendDir = p >= n ? 1 : -1;
    } else if (this.trendDir !== 0 && a < ADX_EXIT) {
      this.trendDir = 0;
    } else if (this.trendDir !== 0) {
      const dir: TrendDir = p >= n ? 1 : -1;
      if (dir !== this.trendDir) this.trendDir = dir;
    }

    if (this.trendDir !== prevDir) {
      if (this.trendDir === 0) {
        this.log('🧭', `Режим: ADX 1ч ${a.toFixed(0)} ниже ${ADX_EXIT} → двусторонний режим`);
      } else {
        const sideTxt = this.trendDir === 1 ? 'ЛОНГ' : 'ШОРТ';
        this.log(
          '🧭',
          `Режим: ADX 1ч ${a.toFixed(0)} перешёл ${ADX_ENTER} → тренд ${sideTxt}, про-трендовый вход 0.3×stepG`,
        );
        this.log('🛡', 'Защита R190: контр-трендовый перехватчик не вооружается');
      }
      if (this.running) this.armCatchers();
    }
  }

  /* ---------------- перехватчики и ноги ---------------- */

  private legSize(price: number): { qty: number; notional: number; margin: number } {
    const equity = this.equityAt(price);
    let margin = equity * this.params.legEquityPct;
    let notional = margin * this.params.leverage;
    if (notional < MIN_NOTIONAL) {
      notional = MIN_NOTIONAL;
      margin = notional / this.params.leverage;
    }
    return { qty: notional / price, notional, margin };
  }

  /** Вооружить перехватчики от якоря с учётом R190. */
  armCatchers() {
    if (!this.running || this.anchor == null) return;
    const a = this.anchor;
    const mk = (side: Side): PendingCatcher => {
      const proTrend = this.trendDir !== 0 && ((side === 'L' && this.trendDir === 1) || (side === 'S' && this.trendDir === -1));
      const contra = this.trendDir !== 0 && !proTrend;
      if (contra) return { side, price: 0, armed: false };
      const mult = this.trendDir !== 0 ? 0.3 : 0.5; // R190: про-тренд ближе
      const price = side === 'L' ? a * (1 - mult * this.stepG) : a * (1 + mult * this.stepG);
      return { side, price, armed: true };
    };
    const hasOpen = (side: Side) => this.legs.some((l) => l.side === side);
    const prevL = this.pendings.find((p) => p.side === 'L');
    const prevS = this.pendings.find((p) => p.side === 'S');
    const nextL = hasOpen('L') ? { side: 'L' as Side, price: 0, armed: false } : mk('L');
    const nextS = hasOpen('S') ? { side: 'S' as Side, price: 0, armed: false } : mk('S');
    // не перезаписываем уже исполненные/эквивалентные
    this.pendings = [nextL, nextS];
    if (prevL?.armed && !nextL.armed && this.trendDir === -1 && !hasOpen('L')) {
      this.log('🚫', 'Контр-трендовый перехватчик ЛОНГ не вооружён (R190)');
    }
    if (prevS?.armed && !nextS.armed && this.trendDir === 1 && !hasOpen('S')) {
      this.log('🚫', 'Контр-трендовый перехватчик ШОРТ не вооружён (R190)');
    }
  }

  private openLeg(side: Side, price: number, catcher: boolean, ts: number) {
    const { qty, margin } = this.legSize(price);
    const effQty = catcher ? qty * 0.5 : qty; // перехватчик — половина ноги
    const effNotional = effQty * price;
    const effMargin = catcher ? margin * 0.5 : margin;
    const entryFee = effNotional * TAKER_FEE;
    this.cashDelta(-entryFee, ts);
    const tp = side === 'L' ? price * (1 + this.stepG) : price * (1 - this.stepG);
    this.legs.push({
      id: this.nextId++,
      side,
      entry: price,
      tp,
      qty: effQty,
      notional: effNotional,
      margin: effMargin,
      entryFee,
      openTime: ts,
      catcher,
    });
    const sideTxt = side === 'L' ? 'ЛОНГ' : 'ШОРТ';
    this.log(
      '⚡',
      `Перехватчик ${sideTxt} исполнен @ ${fmtNum(price, 1)} · ТР ${fmtNum(tp, 1)} · номинал ${fmtNum(effNotional, 1)} USDT`,
    );
  }

  private closeLeg(leg: Leg, price: number, ts: number) {
    const dir = leg.side === 'L' ? 1 : -1;
    const gross = (price - leg.entry) * leg.qty * dir;
    const exitFee = Math.abs(price * leg.qty) * TAKER_FEE;
    this.cashDelta(gross - exitFee, ts);
    const net = gross - exitFee - leg.entryFee;
    const st = leg.side === 'L' ? this.statsL : this.statsS;
    st.trades += 1;
    st.realized += net;
    this.trades += 1;
    if (net > 0) {
      st.wins += 1;
      this.wins += 1;
    }
    this.legs = this.legs.filter((l) => l.id !== leg.id);
    const sideTxt = leg.side === 'L' ? 'ЛОНГ' : 'ШОРТ';
    this.log(
      net >= 0 ? '✅' : '🛑',
      `ТР ${sideTxt} @ ${fmtNum(price, 1)} · нетто ${net >= 0 ? '+' : ''}${fmtNum(net, 2)} USDT`,
    );
    // перевооружить перехватчик этой стороны от якоря
    if (this.running) this.armCatchers();
  }

  /**
   * Исполнение касанием цены: вызывается со свечи 1м (h/l) и с тикера (p/p).
   */
  onPriceRange(high: number, low: number, ts: number) {
    if (!Number.isFinite(high) || !Number.isFinite(low) || high <= 0) return;
    // 1) ТР открытых ног
    for (const leg of [...this.legs]) {
      if (leg.side === 'L' && high >= leg.tp) this.closeLeg(leg, leg.tp, ts);
      else if (leg.side === 'S' && low <= leg.tp) this.closeLeg(leg, leg.tp, ts);
    }
    // 2) Ждущие перехватчики
    if (this.running) {
      for (const p of [...this.pendings]) {
        if (!p.armed || p.price <= 0) continue;
        if (p.side === 'L' && low <= p.price) {
          p.armed = false;
          this.openLeg('L', p.price, true, ts);
        } else if (p.side === 'S' && high >= p.price) {
          p.armed = false;
          this.openLeg('S', p.price, true, ts);
        }
      }
    }
  }

  onCandle1m(candle: Candle) {
    this.onPriceRange(candle.h, candle.l, candle.t);
  }

  onTickerPrice(price: number) {
    this.onPriceRange(price, price, Date.now());
    this.trackEquity(price);
  }
}
