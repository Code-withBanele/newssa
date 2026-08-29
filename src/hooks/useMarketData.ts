import { useCallback, useEffect, useState } from "react";
import { fetchMarketData } from "../api/alphaVantage";
import { MarketQuote } from "../types/market";

interface MarketDataState {
  data: MarketQuote[];
  loading: boolean;
  error: string | null;
}

export function useMarketData() {
  const [state, setState] = useState<MarketDataState>({ data: [], loading: true, error: null });

  const refresh = useCallback(() => {
    let cancelled = false;
    setState(current => ({ ...current, loading: true, error: null }));
    fetchMarketData()
      .then(data => {
        if (!cancelled) setState({ data, loading: false, error: data.every(item => item.status === "unavailable") ? data[0]?.error ?? "Market data unavailable." : null });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: [], loading: false, error: error.message });
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => refresh(), [refresh]);

  return { ...state, refresh };
}
