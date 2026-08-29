import { usePosts } from "./usePosts";
import { Article } from "../utils/transform";

interface UseFeaturedPostsState {
  featured: Article | null;
  secondary: Article[];
  loading: boolean;
  error: string | null;
}

export function useFeaturedPosts(count = 7): UseFeaturedPostsState {
  const { articles, loading, error } = usePosts(
    { per_page: count, orderby: "date", order: "desc" },
    [count]
  );

  return {
    featured: articles[0] ?? null,
    secondary: articles.slice(1),
    loading,
    error,
  };
}
