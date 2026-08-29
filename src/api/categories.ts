import { WPCategory } from "../types/wordpress";
import { apiClient } from "../services/apiClient";

export async function fetchCategories(): Promise<WPCategory[]> {
  const { data } = await apiClient.requestPaged<WPCategory>("/categories", { per_page: 100 });
  return data;
}

export async function fetchCategory(id: number): Promise<WPCategory> {
  return apiClient.request<WPCategory>(`/categories/${id}`);
}

export async function fetchCategoryBySlug(slug: string): Promise<WPCategory | null> {
  const { data } = await apiClient.requestPaged<WPCategory>("/categories", { slug, per_page: 1 });
  return data[0] ?? null;
}
