/**
 * Bybit API v5 — публичный WebSocket + REST kline.
 * Контракты из info.md:
 *  - WS: wss://stream.bybit.com/v5/public/linear, топики tickers.{SYM} и kline.{1|3|5|15|30|60}.{SYM},
 *    subscribe {"op":"subscribe","args":[...]}, ping каждые ~20с {"op":"ping"}.
 *  - REST: GET https://api.bybit.com/v5/market/kline — из браузера может быть недоступен
 *    (geo-block) → вызывающий код ловит ошибку и честно включает fallback (restAvailable=false).
 * Без моков.
 */

export interface Candle {
  t: number; // время открытия, ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type KlineInterval = '1' | '3' | '5' | '15' | '30' | '60';

export const KLINE_INTERVALS: KlineInterval[] = ['1', '3', '5', '15', '30', '60'];

export const WS_URL = 'wss://stream.bybit.com/v5/public/linear';
export const REST_URL = 'https://api.bybit.com/v5/market/kline';

export type WsStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

export interface BybitWsHandlers {
  onStatus(status: WsStatus): void;
  onTicker(symbol: string, price: number): void;
  /** confirm=true — свеча закрыта; confirm=false — живое обновление текущей свечи */
  onKline(interval: KlineInterval, symbol: string, candle: Candle, confirm: boolean): void;
}

const PING_MS = 20_000;
const BACKOFF_MAX_MS = 30_000;

export class BybitWs {
  private ws: WebSocket | null = null;
  private topics = new Set<string>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private stopped = true;
  private handlers: BybitWsHandlers;

  constructor(handlers: BybitWsHandlers) {
    this.handlers = handlers;
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    this.clearTimers();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onopen = null;
      try {
        this.ws.close();
      } catch {
        /* noop */
      }
      this.ws = null;
    }
  }

  subscribe(topics: string[]) {
    const fresh = topics.filter((t) => !this.topics.has(t));
    fresh.forEach((t) => this.topics.add(t));
    if (fresh.length && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op: 'subscribe', args: fresh }));
    }
  }

  unsubscribe(topics: string[]) {
    const gone = topics.filter((t) => this.topics.has(t));
    gone.forEach((t) => this.topics.delete(t));
    if (gone.length && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op: 'unsubscribe', args: gone }));
    }
  }

  private connect() {
    if (this.stopped) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.handlers.onStatus('offline');
      this.scheduleReconnect();
      return;
    }
    this.handlers.onStatus(this.attempts === 0 ? 'connecting' : 'reconnecting');
    try {
      this.ws = new WebSocket(WS_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.attempts = 0;
      this.handlers.onStatus('online');
      if (this.topics.size) {
        this.ws?.send(JSON.stringify({ op: 'subscribe', args: [...this.topics] }));
      }
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ op: 'ping' }));
        }
      }, PING_MS);
    };

    this.ws.onmessage = (ev) => {
      this.handleMessage(ev.data as string);
    };

    this.ws.onclose = () => {
      this.clearPing();
      if (!this.stopped) {
        this.handlers.onStatus(
          typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'reconnecting',
        );
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose последует и займётся реконнектом
    };
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    const delay = Math.min(1000 * 2 ** this.attempts, BACKOFF_MAX_MS);
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearTimers() {
    this.clearPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleMessage(raw: string) {
    let msg: {
      op?: string;
      topic?: string;
      type?: string;
      data?: unknown;
    };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg.topic || !msg.data) return;

    if (msg.topic.startsWith('tickers.')) {
      const d = msg.data as { symbol?: string; lastPrice?: string };
      const price = Number(d.lastPrice);
      if (d.symbol && Number.isFinite(price) && price > 0) {
        this.handlers.onTicker(d.symbol, price);
      }
      return;
    }

    if (msg.topic.startsWith('kline.')) {
      const parts = msg.topic.split('.');
      const interval = parts[1] as KlineInterval;
      const rows = msg.data as Array<{
        start: number;
        open: string;
        high: string;
        low: string;
        close: string;
        volume: string;
        confirm: boolean;
      }>;
      for (const r of rows) {
        const candle: Candle = {
          t: Number(r.start),
          o: Number(r.open),
          h: Number(r.high),
          l: Number(r.low),
          c: Number(r.close),
          v: Number(r.volume),
        };
        this.handlers.onKline(interval, parts[2] ?? '', candle, Boolean(r.confirm));
      }
    }
  }
}

/** Upsert свечи в массив (по времени открытия), возвращает новый массив, cap по длине. */
export function upsertCandle(list: Candle[], candle: Candle, cap = 500): Candle[] {
  const next = list.length ? list.slice() : [];
  const lastIdx = next.length - 1;
  if (lastIdx >= 0 && next[lastIdx].t === candle.t) {
    next[lastIdx] = candle;
  } else if (lastIdx >= 0 && next[lastIdx].t < candle.t) {
    next.push(candle);
  } else {
    const idx = next.findIndex((c) => c.t === candle.t);
    if (idx >= 0) next[idx] = candle;
    else {
      next.push(candle);
      next.sort((a, b) => a.t - b.t);
    }
  }
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/**
 * История свечей через REST. Бросает ошибку при недоступности (CORS/geo-block/сеть) —
 * вызывающий код обязан поймать и включить честный fallback (свечи накапливаются из WS).
 */
export async function fetchKlines(
  symbol: string,
  interval: KlineInterval,
  limit = 200,
): Promise<Candle[]> {
  const url = `${REST_URL}?category=linear&symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Bybit REST HTTP ${resp.status}`);
  const json = (await resp.json()) as {
    retCode: number;
    retMsg?: string;
    result?: { list?: string[][] };
  };
  if (json.retCode !== 0 || !json.result?.list) {
    throw new Error(`Bybit REST retCode ${json.retCode}: ${json.retMsg ?? 'unknown'}`);
  }
  // Bybit отдаёт список от новых к старым: [startTime, open, high, low, close, volume, turnover]
  return json.result.list
    .map((row) => ({
      t: Number(row[0]),
      o: Number(row[1]),
      h: Number(row[2]),
      l: Number(row[3]),
      c: Number(row[4]),
      v: Number(row[5]),
    }))
    .filter((c) => Number.isFinite(c.t) && Number.isFinite(c.c))
    .sort((a, b) => a.t - b.t);
}
