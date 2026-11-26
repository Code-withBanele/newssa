import { useState, useEffect } from "react";
import { fetchPosts } from "../api/posts";
import { transformPosts, Article } from "../utils/transform";

interface UseSearchState {
  results: Article[];
  loading: boolean;
  error: string | null;
  total: number;
  totalPages: number;
}

export function useSearch(query: string, categoryIds?: number[], page = 1): UseSearchState {
  const [state, setState] = useState<UseSearchState>({
    results: [],
    loading: false,
    error: null,
    total: 0,
    totalPages: 1,
  });

  useEffect(() => {
    if (!query.trim()) {
      setState({ results: [], loading: false, error: null, total: 0, totalPages: 1 });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setState(current => ({ ...current, loading: true, error: null }));
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
            totalPages: pagination.totalPages,
          });
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setState({ results: [], loading: false, error: err.message, total: 0, totalPages: 1 });
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, categoryIds?.join(","), page]);

  return state;
}
