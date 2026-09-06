export const siteUrl = (process.env.VITE_SITE_URL || "https://newssa.co.za").replace(/\/$/, "");
export const wordpressApi = process.env.VITE_WORDPRESS_API || "https://newssa.co.za/wp-json/wp/v2";

export function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '\"': "&quot;" }[character] || character));
}

export async function fetchAll<T>(path: string) {
  const items: T[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = new URL(`${wordpressApi}${path}`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404 && page > 1) break;
      throw new Error(`WordPress request failed: ${response.status}`);
    }
    const pageItems = await response.json() as T[];
    if (pageItems.length === 0) break;
    items.push(...pageItems);
    totalPages = Number(response.headers.get("X-WP-TotalPages") || 1);
    page += 1;
  } while (page <= totalPages);
  return items;
}