const CATEGORY_SLUG_OVERRIDES: Record<string, string> = {
  lifestyle: "life-style",
};

export function categorySlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return CATEGORY_SLUG_OVERRIDES[slug] ?? slug;
}