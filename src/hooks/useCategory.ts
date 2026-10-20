import { useState, useEffect } from "react";
import { fetchCategoryBySlug } from "../api/categories";
import { fetchPosts } from "../api/posts";
import { transformPosts, Article } from "../utils/transform";
import { categorySlug } from "../utils/categorySlug";
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

  const slug = categorySlug(nameOrSlug);

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));

    async function loadCategory() {
      try {
        if (slug === "news") {
          const { data, pagination } = await fetchPosts({ page, per_page: perPage, orderby: "date", order: "desc" });
          if (cancelled) return;
          setState({
            category: null,
            articles: transformPosts(data),
            loading: false,
            error: null,
            total: pagination.total,
            totalPages: pagination.totalPages,
          });
          return;
        }

        const cat = await fetchCategoryBySlug(slug);
        if (cancelled) return;
        if (!cat) {
          setState(s => ({ ...s, loading: false, error: "Category not found." }));
          return;
        }
        const { data, pagination } = await fetchPosts({ categories: [cat.id], page, per_page: perPage, orderby: "date", order: "desc" });
        if (cancelled) return;
        setState({
          category: cat,
          articles: transformPosts(data),
          loading: false,
          error: null,
          total: pagination.total,
          totalPages: pagination.totalPages,
        });
      } catch (err) {
        if (cancelled) return;
        setState(s => ({ ...s, loading: false, error: err instanceof Error ? err.message : "Unable to load category." }));
      }
    }

    void loadCategory();

    return () => { cancelled = true; };
  }, [slug, page, perPage]);

  return state;
}
