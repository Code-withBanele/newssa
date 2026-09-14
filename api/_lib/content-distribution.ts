import { randomBytes, timingSafeEqual } from "node:crypto";
import { createHmac } from "node:crypto";

export const PLATFORM_OPTIONS = ["facebook", "instagram", "linkedin", "x"] as const;
export type SocialPlatform = (typeof PLATFORM_OPTIONS)[number];
export type DistributionJobStatus = "queued" | "processing" | "completed" | "partial" | "failed";
export type PublicationStatus = "queued" | "scheduled" | "published" | "failed" | "skipped";

export interface NormalizedArticle {
  wordpressPostId: number;
  title: string;
  slug: string;
  excerpt: string | null;
  contentHtml: string;
  contentText: string;
  articleUrl: string;
  publishedAt: string;
  modifiedAt: string;
  author: string;
  category: string | null;
  tags: string[];
  featuredImage: string | null;
  source: "wordpress";
}

export interface PlatformRow {
  platform: string;
  status: string;
}

export const DEFAULT_PLATFORM_LIST = "facebook,instagram,linkedin,x";

export function normalizePlatformName(value: string | null | undefined): SocialPlatform | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  return PLATFORM_OPTIONS.includes(normalized as SocialPlatform) ? (normalized as SocialPlatform) : null;
}

export function getEnabledPlatforms(envValue = process.env.CONTENT_DISTRIBUTION_PLATFORMS ?? DEFAULT_PLATFORM_LIST): SocialPlatform[] {
  const values = String(envValue)
    .split(",")
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
    .map(normalizePlatformName)
    .filter((item): item is SocialPlatform => item !== null);

  const unique = Array.from(new Set(values));
  if (!unique.length) {
    throw new Error("CONTENT_DISTRIBUTION_PLATFORMS is empty or invalid. Configure a comma-separated list such as facebook,instagram,linkedin,x.");
  }
  return unique;
}

export function constantTimeEquals(expected: string, actual: string): boolean {
  if (!expected || !actual) return false;
  const a = new Uint8Array(Buffer.from(expected));
  const b = new Uint8Array(Buffer.from(actual));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isValidHttpUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function stripHtml(value: string): string {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function plainTextFromHtml(value: string): string {
  return stripHtml(value || "");
}

function safeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function findCategoryName(post: Record<string, any>): string | null {
  const embedded = Array.isArray(post?._embedded?.["wp:term"]) ? post._embedded["wp:term"] : [];
  for (const group of embedded) {
    if (!Array.isArray(group)) continue;
    const category = group.find((term: any) => term && term.taxonomy === "category" && term.name && term.name !== "Uncategorized");
    if (category?.name) return String(category.name);
  }
  return null;
}

function findTags(post: Record<string, any>): string[] {
  const embedded = Array.isArray(post?._embedded?.["wp:term"]) ? post._embedded["wp:term"] : [];
  const tagNames: string[] = [];
  for (const group of embedded) {
    if (!Array.isArray(group)) continue;
    for (const term of group) {
      if (term && term.taxonomy === "post_tag" && term.name) tagNames.push(String(term.name));
    }
  }
  return Array.from(new Set(tagNames));
}

function findFeaturedImage(post: Record<string, any>): string | null {
  const media = post?._embedded?.["wp:featuredmedia"]?.[0];
  if (!media) return null;
  const sourceUrl = typeof media.source_url === "string" ? media.source_url : null;
  if (sourceUrl && isValidHttpUrl(sourceUrl)) return sourceUrl;
  const sizes = media.media_details?.sizes ?? {};
  const candidates = [sizes.large, sizes.medium_large, sizes.medium, sizes.thumbnail];
  for (const candidate of candidates) {
    const url = candidate?.source_url;
    if (typeof url === "string" && isValidHttpUrl(url)) return url;
  }
  return null;
}

export function normalizeWordPressArticle(post: any): NormalizedArticle | null {
  if (!post || typeof post !== "object") return null;

  const title = stripHtml(safeString(post?.title?.rendered, ""));
  if (!title) return null;

  const articleUrl = isValidHttpUrl(post?.link) ? String(post.link) : null;
  if (!articleUrl) return null;

  const excerpt = stripHtml(safeString(post?.excerpt?.rendered, ""));
  const contentHtml = typeof post?.content?.rendered === "string" ? post.content.rendered : "";
  const contentText = plainTextFromHtml(contentHtml) || title;
  const authorName = safeString(post?._embedded?.author?.[0]?.name, "News South Africa") || "News South Africa";
  const category = findCategoryName(post as Record<string, any>) ?? null;
  const tags = findTags(post as Record<string, any>);
  const featuredImage = findFeaturedImage(post as Record<string, any>);

  return {
    wordpressPostId: Number(post.id),
    title,
    slug: safeString(post?.slug, title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "article"),
    excerpt: excerpt || null,
    contentHtml,
    contentText,
    articleUrl,
    publishedAt: safeString(post?.date || post?.date_gmt, new Date().toISOString()),
    modifiedAt: safeString(post?.modified || post?.date || post?.date_gmt, new Date().toISOString()),
    author: authorName,
    category,
    tags,
    featuredImage,
    source: "wordpress",
  };
}

export function calculateJobStatus(platformRows: PlatformRow[], jobFailed = false): DistributionJobStatus {
  if (jobFailed) return "failed";
  if (!platformRows.length) return "failed";

  const published = platformRows.filter(row => row.status === "published").length;
  const failed = platformRows.filter(row => row.status === "failed").length;
  const skipped = platformRows.filter(row => row.status === "skipped").length;
  const queuedOrScheduled = platformRows.filter(row => row.status === "queued" || row.status === "scheduled").length;

  if (published === platformRows.length && platformRows.length > 0) return "completed";
  if (published > 0 && failed > 0) return "partial";
  if (published === 0 && failed === platformRows.length) return "failed";
  if (published === 0 && skipped === platformRows.length) return "failed";
  if (queuedOrScheduled > 0) return "processing";
  return "queued";
}

export function buildDispatchPayload(jobId: number, article: NormalizedArticle, enabledPlatforms: SocialPlatform[]) {
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://localhost:3000";
  return {
    event: "distribution.job.created",
    job_id: jobId,
    article: {
      wordpress_post_id: article.wordpressPostId,
      title: article.title,
      excerpt: article.excerpt,
      article_url: article.articleUrl,
      featured_image_url: article.featuredImage,
      category: article.category,
      published_at: article.publishedAt,
    },
    distribution: {
      platforms: enabledPlatforms,
      schedule: {
        enabled: false,
        timezone: "Africa/Johannesburg",
        posts_per_day: 1,
      },
    },
    callback: {
      url: `${baseUrl}/api/automation/social-status`,
      job_id: jobId,
    },
  };
}

export function getDispatchEnabled(): boolean {
  const raw = String(process.env.CONTENT_DISTRIBUTION_DISPATCH_ENABLED ?? "false").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function getWebhookSecret(): string | null {
  const value = String(process.env.CONTENT_DISTRIBUTION_WEBHOOK_SECRET ?? "").trim();
  return value || null;
}

export function verifyWebhookSignature(rawBody: string, providedSignature: string | string[] | undefined): boolean {
  const secret = getWebhookSecret();
  if (!secret) return true;
  const candidate = Array.isArray(providedSignature) ? providedSignature[0] : providedSignature;
  if (!candidate) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const actual = String(candidate).replace(/^sha256=/i, "");
  return constantTimeEquals(expected, actual);
}

export function buildJobErrorResponse(error: unknown) {
  return { success: false, error: error instanceof Error ? error.message : "Unexpected server error." };
}

export function createEventId(): string {
  return randomBytes(16).toString("hex");
}
