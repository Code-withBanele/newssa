import { WPUser } from "../types/wordpress";
import { apiClient } from "../services/apiClient";

export async function fetchAuthor(id: number): Promise<WPUser> {
  return apiClient.request<WPUser>(`/users/${id}`);
}

export async function fetchAuthors(): Promise<WPUser[]> {
  const { data } = await apiClient.requestPaged<WPUser>("/users", { per_page: 100 });
  return data;
}
