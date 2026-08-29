import { WPMedia } from "../types/wordpress";
import { apiClient } from "../services/apiClient";

export async function fetchMedia(id: number): Promise<WPMedia> {
  return apiClient.request<WPMedia>(`/media/${id}`);
}

export function getBestImageUrl(media: WPMedia, preferredSize = "medium_large"): string {
  const sizes = media.media_details?.sizes;
  if (sizes) {
    const preferred = sizes[preferredSize] ?? sizes["large"] ?? sizes["medium"] ?? sizes["thumbnail"];
    if (preferred) return preferred.source_url;
  }
  return media.source_url;
}
