import { useState, useEffect } from "react";
import { fetchPost, fetchPostBySlug } from "../api/posts";
import { transformPost, Article } from "../utils/transform";

interface UsePostState {
  article: Article | null;
  loading: boolean;
  error: string | null;
}

export function usePost(id: number): UsePostState {
  const [state, setState] = useState<UsePostState>({ article: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ article: null, loading: true, error: null });

    fetchPost(id)
      .then(post => {
        if (cancelled) return;
        setState({ article: transformPost(post), loading: false, error: null });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ article: null, loading: false, error: err.message });
      });

    return () => { cancelled = true; };
  }, [id]);

  return state;
}

export function usePostBySlug(slug: string): UsePostState {
  const [state, setState] = useState<UsePostState>({ article: null, loading: true, error: null });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setState({ article: null, loading: true, error: null });

    fetchPostBySlug(slug)
      .then(post => {
        if (cancelled) return;
        setState({
          article: post ? transformPost(post) : null,
          loading: false,
          error: post ? null : "Article not found.",
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ article: null, loading: false, error: err.message });
      });

    return () => { cancelled = true; };
  }, [slug]);

  return state;
}
