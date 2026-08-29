import { useState, useEffect } from "react";
import { fetchCategoryBySlug } from "../api/categories";
import { fetchPosts } from "../api/posts";
import { transformPosts, Article } from "../utils/transform";
import { WPCategory } from "../types/wordpress";

interface UseCategoryState {
  category: WPCategory | null;
  articles: Article[];
  loading: boolean;
  error: string | null;
  total: number;
  totalPages: number;
}

export function useCategory(nameOrSlug: string, page = 1, perPage = 12): UseCategoryState {
  const [state, setState] = useState<UseCategoryState>({
    category: null,
    articles: [],
    loading: true,
    error: null,
    total: 0,
    totalPages: 1,
  });

  const slug = nameOrSlug.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and");

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));

    fetchCategoryBySlug(slug)
      .then(cat => {
        if (cancelled) return;
        if (!cat) {
          setState(s => ({ ...s, loading: false, error: "Category not found." }));
          return;
        }
        return fetchPosts({ categories: [cat.id], page, per_page: perPage, orderby: "date", order: "desc" })
          .then(({ data, pagination }) => {
            if (cancelled) return;
            setState({
              category: cat,
              articles: transformPosts(data),
              loading: false,
              error: null,
              total: pagination.total,
              totalPages: pagination.totalPages,
            });
          });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState(s => ({ ...s, loading: false, error: err.message }));
      });

    return () => { cancelled = true; };
  }, [slug, page, perPage]);

  return state;
}
