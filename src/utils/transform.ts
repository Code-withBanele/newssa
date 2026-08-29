import { WPPost, WPMedia, WPUser, WPTerm } from "../types/wordpress";

// ── Normalised article model used by React UI components ──────────────────────
export interface Article {
  id: number;
  slug: string;
  title: string;
  subtitle: string;  // WP excerpt, stripped of HTML
  category: string;
  author: string;
  date: string;       // Formatted display date
  timeAgo: string;
  readTime: string;   // Estimated from word count
  image: string;      // Best available featured image URL
  imageAlt: string;
  body: string[];     // Paragraphs split from rendered content
  pullQuote?: string;
  link: string;       // Canonical WP permalink
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  const withoutTags = html.replace(/<[^>]+>/g, "");
  return new DOMParser().parseFromString(withoutTags, "text/html").documentElement.textContent?.trim() ?? "";
}

function estimateReadTime(text: string): string {
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function getFeaturedImageUrl(post: WPPost): string {
  const media = post._embedded?.["wp:featuredmedia"]?.[0] as WPMedia | undefined;
  if (!media) return "";
  const sizes = media.media_details?.sizes;
  if (sizes) {
    const s = sizes["medium_large"] ?? sizes["large"] ?? sizes["medium"] ?? sizes["thumbnail"];
    if (s) return s.source_url;
  }
  return media.source_url ?? "";
}

function getFeaturedImageAlt(post: WPPost): string {
  const media = post._embedded?.["wp:featuredmedia"]?.[0] as WPMedia | undefined;
  return media?.alt_text ?? stripHtml(post.title.rendered);
}

function getAuthorName(post: WPPost): string {
  const author = post._embedded?.author?.[0] as WPUser | undefined;
  return author?.name ?? "News South Africa";
}

function getPrimaryCategory(post: WPPost): string {
  const terms = post._embedded?.["wp:term"] ?? [];
  const categories = (terms[0] ?? []) as WPTerm[];
  const cat = categories.find(t => t.taxonomy === "category" && t.slug !== "uncategorized");
  return cat?.name ?? categories[0]?.name ?? "News";
}

function splitIntoParagraphs(html: string): string[] {
  // Extract text from <p> tags; fall back to splitting on blank lines
  const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  if (pMatches.length > 0) {
    return pMatches
      .map(m => stripHtml(m[1]))
      .filter(p => p.length > 0);
  }
  return stripHtml(html)
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

function extractPullQuote(paragraphs: string[]): string | undefined {
  // Look for a <blockquote> in the raw content
  return paragraphs.find(p => p.length > 60 && p.length < 240);
}

// ── Main transformer ───────────────────────────────────────────────────────────

export function transformPost(post: WPPost): Article {
  const body = splitIntoParagraphs(post.content.rendered);
  const plainBody = body.join(" ");

  return {
    id: post.id,
    slug: post.slug,
    title: stripHtml(post.title.rendered),
    subtitle: stripHtml(post.excerpt.rendered),
    category: getPrimaryCategory(post),
    author: getAuthorName(post),
    date: formatDate(post.date),
    timeAgo: timeAgo(post.date),
    readTime: estimateReadTime(plainBody),
    image: getFeaturedImageUrl(post),
    imageAlt: getFeaturedImageAlt(post),
    body,
    pullQuote: extractPullQuote(body),
    link: post.link,
  };
}

export function transformPosts(posts: WPPost[]): Article[] {
  return posts.map(transformPost);
}
