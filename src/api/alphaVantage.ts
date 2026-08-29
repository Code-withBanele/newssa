import { MarketInstrument, MarketPoint, MarketQuote } from "../types/market";

const API_URL = "https://www.alphavantage.co/query";
const CACHE_TTL = 5 * 60 * 1000;

export const MARKET_INSTRUMENTS: MarketInstrument[] = [
  { id: "jse-top-40", name: "JSE Top 40", symbol: "JSE Top 40", category: "Index", function: "TIME_SERIES_DAILY", supported: false },
  { id: "sp500", name: "S&P 500", symbol: "SPY", category: "Index", function: "TIME_SERIES_DAILY", supported: true },
  { id: "nasdaq", name: "NASDAQ", symbol: "QQQ", category: "Index", function: "TIME_SERIES_DAILY", supported: true },
  { id: "dow-jones", name: "Dow Jones", symbol: "DIA", category: "Index", function: "TIME_SERIES_DAILY", supported: true },
  { id: "ftse-100", name: "FTSE 100", symbol: "ISF.L", category: "Index", function: "TIME_SERIES_DAILY", supported: true },
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC", category: "Crypto", function: "DIGITAL_CURRENCY_DAILY", fromCurrency: "BTC", toCurrency: "USD", supported: true },
  { id: "ethereum", name: "Ethereum", symbol: "ETH", category: "Crypto", function: "DIGITAL_CURRENCY_DAILY", fromCurrency: "ETH", toCurrency: "USD", supported: true },
  { id: "gold", name: "Gold", symbol: "GOLD", category: "Commodity", function: "GOLD_SILVER_SPOT", supported: true },
  { id: "brent-crude", name: "Brent Crude", symbol: "BRENT", category: "Commodity", function: "BRENT", supported: true },
  { id: "usd-zar", name: "USD/ZAR", symbol: "USD/ZAR", category: "Currency", function: "FX_DAILY", fromCurrency: "USD", toCurrency: "ZAR", supported: true },
  { id: "eur-zar", name: "EUR/ZAR", symbol: "EUR/ZAR", category: "Currency", function: "FX_DAILY", fromCurrency: "EUR", toCurrency: "ZAR", supported: true },
  { id: "gbp-zar", name: "GBP/ZAR", symbol: "GBP/ZAR", category: "Currency", function: "FX_DAILY", fromCurrency: "GBP", toCurrency: "ZAR", supported: true },
  { id: "naspers", name: "Naspers", symbol: "NPN.JO", category: "Equity", function: "TIME_SERIES_DAILY", supported: true },
  { id: "sasol", name: "Sasol", symbol: "SOL.JO", category: "Equity", function: "TIME_SERIES_DAILY", supported: true },
  { id: "mtn", name: "MTN Group", symbol: "MTN.JO", category: "Equity", function: "TIME_SERIES_DAILY", supported: true },
  { id: "standard-bank", name: "Standard Bank", symbol: "SBK.JO", category: "Equity", function: "TIME_SERIES_DAILY", supported: true },
  { id: "bhp", name: "BHP Group", symbol: "BHP.JO", category: "Equity", function: "TIME_SERIES_DAILY", supported: true },
];

const cache = new Map<string, { expires: number; value: MarketQuote }>();

function numberValue(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(String(value).replace(/[%,$]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function apiError(payload: Record<string, unknown>): string | undefined {
  const message = payload.Note ?? payload.Information ?? payload["Error Message"];
  return typeof message === "string" ? message : undefined;
}

async function request(params: Record<string, string>): Promise<Record<string, unknown>> {
  const apiKey = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("Alpha Vantage is not configured. Set VITE_ALPHA_VANTAGE_API_KEY in .env.local.");
  const url = new URL(API_URL);
  Object.entries({ ...params, apikey: apiKey }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Alpha Vantage request failed: ${response.status}`);
  const payload = await response.json() as Record<string, unknown>;
  const message = apiError(payload);
  if (message) throw new Error(message.includes("call frequency") || message.includes("rate limit") ? "Alpha Vantage rate limit reached. Try again later." : message);
  return payload;
}

function parseSeries(payload: Record<string, unknown>, key: string): MarketPoint[] {
  const raw = payload[key];
  if (!raw || typeof raw !== "object") return [];
  const entries = Array.isArray(raw)
    ? raw.map((row, index) => [String(index), row] as const)
    : Object.entries(raw as Record<string, unknown>);
  return entries
    .map(([date, row]) => {
      const item = row as Record<string, unknown>;
      return { date: typeof item.date === "string" ? item.date : date, value: numberValue(item["4. close"] ?? item["4a. close (USD)"] ?? item["4. close (USD)"] ?? item["5. adjusted close"] ?? item.value) };
    })
    .filter((point): point is MarketPoint => point.value !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);
}

function buildQuote(instrument: MarketInstrument, value: number | null, change: number | null, changePercent: number | null, timestamp: string | null, series: MarketPoint[], error?: string): MarketQuote {
  return {
    id: instrument.id,
    name: instrument.name,
    symbol: instrument.symbol,
    category: instrument.category,
    value,
    change,
    changePercent,
    positive: change === null ? null : change >= 0,
    timestamp,
    status: error || value === null ? "unavailable" : series.length > 1 ? "historical" : "delayed",
    series,
    error,
  };
}

async function fetchInstrument(instrument: MarketInstrument): Promise<MarketQuote> {
  if (!instrument.supported) return buildQuote(instrument, null, null, null, null, [], "Alpha Vantage does not provide a JSE Top 40 index endpoint.");
  const cached = cache.get(instrument.id);
  if (cached && cached.expires > Date.now()) return cached.value;

  try {
    let value: number | null = null;
    let change: number | null = null;
    let changePercent: number | null = null;
    let timestamp: string | null = null;
    let series: MarketPoint[] = [];

    if (instrument.function === "TIME_SERIES_DAILY") {
      series = parseSeries(await request({ function: instrument.function, symbol: instrument.symbol, outputsize: "compact" }), "Time Series (Daily)");
      value = series.at(-1)?.value ?? null;
      const previous = series.at(-2)?.value ?? null;
      change = value !== null && previous !== null ? value - previous : null;
      changePercent = change !== null && previous ? (change / previous) * 100 : null;
      timestamp = series.at(-1)?.date ?? null;
    } else if (instrument.function === "FX_DAILY") {
      const payload = await request({ function: instrument.function, from_symbol: instrument.fromCurrency!, to_symbol: instrument.toCurrency!, outputsize: "compact" });
      series = parseSeries(payload, "Time Series FX (Daily)");
      value = series.at(-1)?.value ?? null;
      const previous = series.at(-2)?.value ?? null;
      change = value !== null && previous !== null ? value - previous : null;
      changePercent = change !== null && previous ? (change / previous) * 100 : null;
      timestamp = series.at(-1)?.date ?? null;
    } else if (instrument.function === "DIGITAL_CURRENCY_DAILY") {
      const payload = await request({ function: instrument.function, symbol: instrument.fromCurrency!, market: instrument.toCurrency!, outputsize: "compact" });
      series = parseSeries(payload, "Time Series (Digital Currency Daily)");
      value = series.at(-1)?.value ?? null;
      const previous = series.at(-2)?.value ?? null;
      change = value !== null && previous !== null ? value - previous : null;
      changePercent = change !== null && previous ? (change / previous) * 100 : null;
      timestamp = series.at(-1)?.date ?? null;
    } else if (instrument.function === "BRENT") {
      const payload = await request({ function: "BRENT", interval: "daily" });
      series = parseSeries(payload, "data");
      value = series.at(-1)?.value ?? null;
      const previous = series.at(-2)?.value ?? null;
      change = value !== null && previous !== null ? value - previous : null;
      changePercent = change !== null && previous ? (change / previous) * 100 : null;
      timestamp = series.at(-1)?.date ?? null;
    } else {
      const payload = await request({ function: "GOLD_SILVER_SPOT", symbol: "GOLD" });
      const row = (payload["Gold Spot"] ?? payload) as Record<string, unknown>;
      value = numberValue(row.price ?? row["Gold Price"]);
      timestamp = typeof row.timestamp === "string" ? row.timestamp : null;
      series = value === null ? [] : [{ date: timestamp ?? new Date().toISOString(), value }];
    }

    const result = buildQuote(instrument, value, change, changePercent, timestamp, series);
    cache.set(instrument.id, { expires: Date.now() + CACHE_TTL, value: result });
    return result;
  } catch (error) {
    return buildQuote(instrument, null, null, null, null, [], error instanceof Error ? error.message : "Market data unavailable.");
  }
}

export async function fetchMarketData(): Promise<MarketQuote[]> {
  return Promise.all(MARKET_INSTRUMENTS.map(fetchInstrument));
}
