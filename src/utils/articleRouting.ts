export type ArticleRoute =
  | { id: number; slug?: never }
  | { slug: string; id?: never };

export function isUsablePathSegment(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value === value.trim()
    && value !== "."
    && value !== ".."
    && !/[\/\\?#\u0000-\u001f]/.test(value);
}

export function isUsableArticleSlug(value: unknown): value is string {
  // Numeric segments are reserved for legacy IDs, so numeric WP slugs use ID URLs.
  return isUsablePathSegment(value) && !/^\d+$/.test(value);
}

export function articlePath(article: { id: number; slug?: string }): string {
  return isUsableArticleSlug(article.slug)
    ? `/article/${encodeURIComponent(article.slug)}`
    : `/article/${article.id}`;
}

export function parseArticleRouteSegment(segment: string): ArticleRoute | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }

  if (/^\d+$/.test(decoded)) {
    const id = Number(decoded);
    return Number.isSafeInteger(id) ? { id } : null;
  }

  return isUsableArticleSlug(decoded) ? { slug: decoded } : null;
}
