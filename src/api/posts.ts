import { WPPost, WPPostsQuery } from "../types/wordpress";
import { apiClient, PagedResponse } from "../services/apiClient";

function buildParams(query: WPPostsQuery): Record<string, string | number | boolean> {
  const p: Record<string, string | number | boolean> = {};
  if (query.page) p.page = query.page;
  if (query.per_page) p.per_page = query.per_page;
  if (query.search) p.search = query.search;
  if (query.categories?.length) p.categories = query.categories.join(",");
  if (query.tags?.length) p.tags = query.tags.join(",");
  if (query.author) p.author = query.author;
  if (query.slug) p.slug = query.slug;
  if (query.status) p.status = query.status;
  if (query.orderby) p.orderby = query.orderby;
  if (query.order) p.order = query.order;
  // Always embed author and featured media
  p._embed = "author,wp:featuredmedia,wp:term";
  return p;
}

export async function fetchPosts(query: WPPostsQuery = {}): Promise<PagedResponse<WPPost>> {
  return apiClient.requestPaged<WPPost>("/posts", buildParams(query));
}

export async function fetchPost(id: number): Promise<WPPost> {
  return apiClient.request<WPPost>(`/posts/${id}`, { _embed: "author,wp:featuredmedia,wp:term" });
}

export async function fetchPostBySlug(slug: string): Promise<WPPost | null> {
  const { data } = await apiClient.requestPaged<WPPost>("/posts", {
    slug,
    _embed: "author,wp:featuredmedia,wp:term",
  });
  return data[0] ?? null;
}

export async function fetchFeaturedPosts(count = 6): Promise<WPPost[]> {
  const { data } = await fetchPosts({ per_page: count, orderby: "date", order: "desc" });
  return data;
}
