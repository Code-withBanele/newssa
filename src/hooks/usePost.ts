import { useState, useEffect } from "react";
import { fetchPost, fetchPostBySlug } from "../api/posts";
import { transformPost, Article } from "../utils/transform";

interface UsePostState {
  article: Article | null;
  loading: boolean;
  error: string | null;
}

export function usePost(identifier: number | string): UsePostState {
  const [state, setState] = useState<UsePostState>({ article: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ article: null, loading: true, error: null });

    const request = typeof identifier === "number" ? fetchPost(identifier) : fetchPostBySlug(identifier);
    request
      .then(post => {
        if (cancelled) return;
        setState(post
          ? { article: transformPost(post), loading: false, error: null }
          : { article: null, loading: false, error: "Article not found." });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ article: null, loading: false, error: err.message });
      });

    return () => { cancelled = true; };
  }, [identifier]);

  return state;
}

export function usePostBySlug(slug: string): UsePostState {
  return usePost(slug);
}
