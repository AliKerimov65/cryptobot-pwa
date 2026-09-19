/**
 * EngineProvider + useEngine() — единая точка доступа page-агентов к движку и данным.
 * Интерфейс хука НЕ меняется page-агентами.
 *
 * Данные: живой Bybit WS (tickers всех наблюдаемых символов + kline 1/3/5/15/30/60 активного),
 * REST-история с честным fallback (restAvailable=false → свечи накапливаются из WS).
 * Persistence: localStorage, ключ 'cryptobot-pwa-v1' (движок + настройки + журнал ≤200).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  BybitWs,
  fetchKlines,
  upsertCandle,
  KLINE_INTERVALS,
} from '@/lib/bybit';
import type { Candle, KlineInterval, WsStatus } from '@/lib/bybit';
import { Conveyor } from '@/engine/conveyor';
import type {
  EngineParams,
  JournalEntry,
  PersistedEngine,
  SideStats,
  TrendDir,
} from '@/engine/conveyor';

export const STORAGE_KEY = 'cryptobot-pwa-v1';
export const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const;
export const DEFAULT_SYMBOL = 'BTCUSDT';

export type { Candle, KlineInterval, WsStatus, JournalEntry, SideStats, TrendDir, EngineParams };

export interface EngineActions {
  start(): void;
  stop(): void;
  reset(): void;
  setSymbol(symbol: string): void;
  setParams(p: Partial<EngineParams>): void;
  clearData(): void;
  /** Повторить запрос REST-истории (кнопка «Повторить» в баннере fallback) */
  retryRest(): void;
}

export interface EngineContextValue {
  /* --- состояние движка --- */
  equity: number;
  cash: number;
  dayRealized: number;
  floatingNet: number;
  trades: number;
  wins: number;
  wr: number; // 0..100
  legsL: number;
  legsS: number;
  pendingL: number | null; // цена ждущего перехватчика ЛОНГ
  pendingS: number | null;
  journal: JournalEntry[]; // новые первыми, ≤200
  trendDir: TrendDir;
  adx: number; // ADX(14, 1ч), NaN пока мало данных
  pdi: number;
  ndi: number;
  stepG: number; // доля, 0.0015..0.02
  anchor: number | null;
  leverage: number;
  k: number;
  legEquityPct: number;
  symbol: string;
  running: boolean;
  wsStatus: WsStatus;
  restAvailable: boolean;
  online: boolean; // navigator.onLine
  maxDD: number; // доля от пика, 0..1
  peakEquity: number;
  statsL: SideStats;
  statsS: SideStats;
  dayKey: string; // YYYY-MM-DD (UTC)
  equityCurve: number[]; // история эквити для спарклайна
  /* --- рынок --- */
  price: number; // цена активного символа (NaN до первого тика)
  prices: Record<string, number>; // цены наблюдаемых символов
  candles: Record<KlineInterval, Candle[]>; // свечи активного символа
  candles1m: Candle[];
  candles15m: Candle[];
  candles1h: Candle[];
  symbols: readonly string[];
  actions: EngineActions;
}

const EngineCtx = createContext<EngineContextValue | null>(null);

interface MarketStore {
  prices: Record<string, number>;
  candles: Record<KlineInterval, Candle[]>;
  wsStatus: WsStatus;
  restAvailable: boolean;
}

function emptyCandles(): Record<KlineInterval, Candle[]> {
  return { '1': [], '3': [], '5': [], '15': [], '30': [], '60': [] };
}

function loadPersisted(): PersistedEngine | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v: number; engine: PersistedEngine };
    return parsed?.engine ?? null;
  } catch {
    return null;
  }
}

export function EngineProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<Conveyor | null>(null);
  if (!engineRef.current) {
    const saved = loadPersisted();
    const eng = new Conveyor(saved?.symbol ?? DEFAULT_SYMBOL, () => {
      dirtyRef.current = true;
      scheduleFlush();
    });
    if (saved) eng.hydrate(saved);
    engineRef.current = eng;
  }
  const marketRef = useRef<MarketStore>({
    prices: {},
    candles: emptyCandles(),
    wsStatus: 'connecting',
    restAvailable: true,
  });
  const wsRef = useRef<BybitWs | null>(null);
  const dirtyRef = useRef(true);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [tick, setTick] = useState(0); // счётчик флашей — снапшот собирается в useMemo

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      dirtyRef.current = true;
      setTick((t) => t + 1);
    }, 50);
  }, []);

  /* ---------- REST-история (честный fallback) ---------- */
  const loadHistory = useCallback(async (symbol: string) => {
    const results = await Promise.allSettled(
      KLINE_INTERVALS.map((iv) => fetchKlines(symbol, iv, 200)),
    );
    let anyOk = false;
    results.forEach((res, i) => {
      const iv = KLINE_INTERVALS[i];
      if (res.status === 'fulfilled' && res.value.length) {
        anyOk = true;
        marketRef.current.candles[iv] = res.value.slice(-500);
      }
    });
    marketRef.current.restAvailable = anyOk;
    if (anyOk) {
      const eng = engineRef.current!;
      const price = marketRef.current.prices[symbol] ?? lastClose(marketRef.current.candles['1']);
      if (Number.isFinite(price) && price > 0) {
        eng.onCandles15m(marketRef.current.candles['15'], price);
      }
      eng.onCandles1h(marketRef.current.candles['60']);
    }
    dirtyRef.current = true;
    scheduleFlush();
  }, [scheduleFlush]);

  /* ---------- WS ---------- */
  useEffect(() => {
    const eng = engineRef.current!;
    const ws = new BybitWs({
      onStatus: (s) => {
        marketRef.current.wsStatus = s;
        dirtyRef.current = true;
        scheduleFlush();
      },
      onTicker: (symbol, price) => {
        marketRef.current.prices[symbol] = price;
        if (symbol === eng.symbol) {
          eng.onTickerPrice(price);
        }
        dirtyRef.current = true;
      },
      onKline: (interval, symbol, candle, confirm) => {
        if (symbol !== eng.symbol) return;
        const arr = upsertCandle(marketRef.current.candles[interval], candle);
        marketRef.current.candles[interval] = arr;
        if (interval === '1') eng.onCandle1m(candle);
        if (confirm && interval === '15') {
          eng.onCandles15m(arr, marketRef.current.prices[eng.symbol] ?? candle.c);
        }
        if (confirm && interval === '60') eng.onCandles1h(arr);
        dirtyRef.current = true;
      },
    });
    wsRef.current = ws;
    ws.start();
    ws.subscribe([
      ...SYMBOLS.map((s) => `tickers.${s}`),
      ...KLINE_INTERVALS.map((iv) => `kline.${iv}.${eng.symbol}`),
    ]);
    loadHistory(eng.symbol);

    const flushInterval = setInterval(() => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        setTick((t) => t + 1);
        persist();
      }
    }, 500);

    const goOnline = () => {
      setOnline(true);
      const w = wsRef.current;
      if (w) {
        w.stop();
        w.start();
      }
    };
    const goOffline = () => {
      setOnline(false);
      marketRef.current.wsStatus = 'offline';
      dirtyRef.current = true;
      scheduleFlush();
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      clearInterval(flushInterval);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      ws.stop();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ v: 1, engine: engineRef.current!.serialize() }),
      );
    } catch {
      /* quota — игнорируем */
    }
  }, []);

  /* ---------- действия ---------- */
  const actions = useMemo<EngineActions>(() => ({
    start: () => {
      const eng = engineRef.current!;
      const price = marketRef.current.prices[eng.symbol] ?? lastClose(marketRef.current.candles['1']);
      if (!Number.isFinite(price) || price <= 0) {
        eng.log('⏳', 'Запуск отложен: ждём первую цену от Bybit');
        dirtyRef.current = true;
        scheduleFlush();
        return;
      }
      eng.start(price);
      dirtyRef.current = true;
      scheduleFlush();
    },
    stop: () => {
      engineRef.current!.stop();
      dirtyRef.current = true;
      scheduleFlush();
    },
    reset: () => {
      engineRef.current!.reset();
      dirtyRef.current = true;
      scheduleFlush();
    },
    setSymbol: (symbol: string) => {
      const eng = engineRef.current!;
      if (symbol === eng.symbol) return;
      const ws = wsRef.current;
      if (ws) {
        ws.unsubscribe(KLINE_INTERVALS.map((iv) => `kline.${iv}.${eng.symbol}`));
        ws.subscribe(KLINE_INTERVALS.map((iv) => `kline.${iv}.${symbol}`));
      }
      eng.symbol = symbol;
      marketRef.current.candles = emptyCandles();
      eng.log('🔁', `Активный символ: ${symbol}`);
      loadHistory(symbol);
      dirtyRef.current = true;
      scheduleFlush();
    },
    setParams: (p) => {
      engineRef.current!.setParams(p);
      dirtyRef.current = true;
      scheduleFlush();
    },
    clearData: () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* noop */
      }
      engineRef.current!.reset();
      engineRef.current!.journal = [];
      dirtyRef.current = true;
      scheduleFlush();
    },
    retryRest: () => {
      loadHistory(engineRef.current!.symbol);
    },
  }), [loadHistory, scheduleFlush]);

  /* ---------- снапшот ---------- */
  const value = useMemo<EngineContextValue>(() => {
    void tick; // пересборка снапшота по флашу
    const eng = engineRef.current!;
    const m = marketRef.current;
    const price = m.prices[eng.symbol] ?? lastClose(m.candles['1']);
    const hasPrice = Number.isFinite(price) && price > 0;
    const floating = hasPrice ? eng.floatingAt(price) : 0;
    const equity = eng.cash + floating;
    const wr = eng.trades > 0 ? (eng.wins / eng.trades) * 100 : 0;
    const pendL = eng.pendings.find((p) => p.side === 'L');
    const pendS = eng.pendings.find((p) => p.side === 'S');
    return {
      equity,
      cash: eng.cash,
      dayRealized: eng.dayRealized,
      floatingNet: floating,
      trades: eng.trades,
      wins: eng.wins,
      wr,
      legsL: eng.legs.filter((l) => l.side === 'L').length,
      legsS: eng.legs.filter((l) => l.side === 'S').length,
      pendingL: pendL?.armed ? pendL.price : null,
      pendingS: pendS?.armed ? pendS.price : null,
      journal: eng.journal,
      trendDir: eng.trendDir,
      adx: eng.adx,
      pdi: eng.pdi,
      ndi: eng.ndi,
      stepG: eng.stepG,
      anchor: eng.anchor,
      leverage: eng.params.leverage,
      k: eng.params.k,
      legEquityPct: eng.params.legEquityPct,
      symbol: eng.symbol,
      running: eng.running,
      wsStatus: online ? m.wsStatus : 'offline',
      restAvailable: m.restAvailable,
      online,
      maxDD: eng.maxDD,
      peakEquity: eng.peakEquity,
      statsL: eng.statsL,
      statsS: eng.statsS,
      dayKey: eng.dayKey,
      equityCurve: eng.equityCurve,
      price: hasPrice ? price : NaN,
      prices: { ...m.prices },
      candles: m.candles,
      candles1m: m.candles['1'],
      candles15m: m.candles['15'],
      candles1h: m.candles['60'],
      symbols: SYMBOLS,
      actions,
    };
  }, [tick, online, actions]);

  return <EngineCtx.Provider value={value}>{children}</EngineCtx.Provider>;
}

function lastClose(arr: Candle[]): number {
  return arr.length ? arr[arr.length - 1].c : NaN;
}

// eslint-disable-next-line react-refresh/only-export-components -- провайдер + хук в одном модуле: стандартный паттерн контекста
export function useEngine(): EngineContextValue {
  const ctx = useContext(EngineCtx);
  if (!ctx) throw new Error('useEngine должен вызываться внутри <EngineProvider>');
  return ctx;
}
