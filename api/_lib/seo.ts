import { articlePath, isUsablePathSegment } from "../../src/utils/articleRouting.js";
import { SITE_URL } from "../../src/utils/site.js";

export const siteUrl = SITE_URL;
const maxWordPressPages = 1000;

export interface SitemapPost {
  id: number;
  slug?: string;
  modified_gmt?: string;
  status: string;
}

export interface SitemapCategory {
  slug: string;
  count: number;
}

export interface SitemapEntry {
  path: string;
  lastmod?: string;
}

function wordPressApiBase(): string {
  const configuredUrl = process.env.VITE_WORDPRESS_API?.trim()
    || "https://newssa.fit/wp-json/wp/v2";

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("VITE_WORDPRESS_API must be a valid absolute URL.");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("VITE_WORDPRESS_API must be an HTTP(S) WordPress REST API base URL.");
  }

  return url.toString().replace(/\/+$/, "");
}

function validLastmod(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const timestampValue = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(timestampValue)) {
    return undefined;
  }
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestampValue);
  const timestamp = Date.parse(hasTimezone ? timestampValue : `${timestampValue}Z`);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

export function buildSitemapEntries(posts: SitemapPost[], categories: SitemapCategory[]): SitemapEntry[] {
  const entries = new Map<string, SitemapEntry>();
  const add = (entry: SitemapEntry) => {
    if (!entries.has(entry.path)) entries.set(entry.path, entry);
  };

  add({ path: "/" });
  add({ path: "/about" });
  add({ path: "/advertise" });
  add({ path: "/category/contact" });

  for (const category of categories) {
    if (
      !isUsablePathSegment(category.slug)
      || category.slug === "uncategorized"
      || category.slug === "contact"
      || !Number.isFinite(category.count)
      || category.count <= 0
    ) continue;
    add({ path: `/category/${encodeURIComponent(category.slug)}` });
  }

  for (const post of posts) {
    if (!Number.isSafeInteger(post.id) || post.id <= 0 || post.status !== "publish") continue;
    add({ path: articlePath({ id: post.id, slug: post.slug }), lastmod: validLastmod(post.modified_gmt) });
  }

  return [...entries.values()];
}

export function escapeXml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&apos;",
    "\"": "&quot;",
  };
  return value.replace(/[<>&'"]/g, character => entities[character]);
}

export function buildSitemapXml(posts: SitemapPost[], categories: SitemapCategory[]): string {
  const urls = buildSitemapEntries(posts, categories).map(({ path, lastmod }) => {
    const location = escapeXml(new URL(path, siteUrl).toString());
    const modification = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : "";
    return `  <url><loc>${location}</loc>${modification}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}

export function buildRobotsTxt(): string {
  return `User-agent: *\nAllow: /\nDisallow: /saved\nDisallow: /api/\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

export async function fetchAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  const apiBase = wordPressApiBase();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    if (page > maxWordPressPages) {
      throw new Error(`WordPress pagination exceeded the ${maxWordPressPages}-page safety limit.`);
    }

    const url = new URL(`${apiBase}${path}`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`WordPress request failed with status ${response.status}.`);

    const pageItems: unknown = await response.json();
    if (!Array.isArray(pageItems)) throw new Error("WordPress returned an invalid paginated response.");
    if (pageItems.length === 0) break;
    items.push(...pageItems as T[]);

    const totalPagesHeader = response.headers.get("X-WP-TotalPages");
    if (totalPagesHeader !== null) {
      const reportedPages = Number(totalPagesHeader);
      if (!Number.isSafeInteger(reportedPages) || reportedPages < 1) {
        throw new Error("WordPress returned an invalid pagination total.");
      }
      totalPages = reportedPages;
    } else {
      totalPages = pageItems.length === 100 ? page + 1 : page;
    }
    page += 1;
  }

  return items;
}
