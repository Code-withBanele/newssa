import { useState, useEffect, useRef } from "react";
import { fetchPosts } from "../api/posts";
import { transformPosts, Article } from "../utils/transform";

interface UseSearchState {
  results: Article[];
  loading: boolean;
  error: string | null;
  total: number;
}

export function useSearch(query: string, categoryIds?: number[], page = 1): UseSearchState {
  const [state, setState] = useState<UseSearchState>({
    results: [],
    loading: false,
    error: null,
    total: 0,
  });

  // Debounce to avoid hammering WP on every keystroke
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setState({ results: [], loading: false, error: null, total: 0 });
      return;
    }

    setState(s => ({ ...s, loading: true, error: null }));

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      let cancelled = false;

      fetchPosts({
        search: query.trim(),
        categories: categoryIds,
        page,
        per_page: 20,
        orderby: "relevance",
      })
        .then(({ data, pagination }) => {
          if (cancelled) return;
          setState({
            results: transformPosts(data),
            loading: false,
            error: null,
            total: pagination.total,
          });
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setState({ results: [], loading: false, error: err.message, total: 0 });
        });

      return () => { cancelled = true; };
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, categoryIds?.join(","), page]);

  return state;
}
