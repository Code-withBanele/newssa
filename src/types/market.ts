export type MarketCategory = "Index" | "Crypto" | "Commodity" | "Currency" | "Equity";
export type MarketStatus = "live" | "delayed" | "historical" | "unavailable";
export type MarketFunction = "TIME_SERIES_DAILY" | "FX_DAILY" | "DIGITAL_CURRENCY_DAILY" | "BRENT" | "GOLD_SILVER_SPOT";

export interface MarketInstrument {
  id: string;
  name: string;
  symbol: string;
  category: MarketCategory;
  function: MarketFunction;
  fromCurrency?: string;
  toCurrency?: string;
  supported: boolean;
}

export interface MarketPoint {
  date: string;
  value: number;
}

export interface MarketQuote {
  id: string;
  name: string;
  symbol: string;
  category: MarketCategory;
  value: number | null;
  change: number | null;
  changePercent: number | null;
  positive: boolean | null;
  timestamp: string | null;
  status: MarketStatus;
  series: MarketPoint[];
  error?: string;
}
