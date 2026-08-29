import { useState, useEffect } from "react";
import { fetchPosts } from "../api/posts";
import { transformPosts, Article } from "../utils/transform";
import { WPPostsQuery } from "../types/wordpress";

interface UsePostsState {
  articles: Article[];
  loading: boolean;
  error: string | null;
  total: number;
  totalPages: number;
}

export function usePosts(query: WPPostsQuery = {}, deps: unknown[] = []): UsePostsState {
  const [state, setState] = useState<UsePostsState>({
    articles: [],
    loading: true,
    error: null,
    total: 0,
    totalPages: 1,
  });

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));

    fetchPosts(query)
      .then(({ data, pagination }) => {
        if (cancelled) return;
        setState({
          articles: transformPosts(data),
          loading: false,
          error: null,
          total: pagination.total,
          totalPages: pagination.totalPages,
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState(s => ({ ...s, loading: false, error: err.message }));
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
