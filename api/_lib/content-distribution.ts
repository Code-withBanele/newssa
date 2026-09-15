import { randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { assertMaxString, RequestValidationError } from "./security.js";

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

export interface ValidatedCallback {
  jobId: number;
  platform: SocialPlatform;
  status: PublicationStatus;
  externalId: string | null;
  publishUrl: string | null;
  idempotencyKey: string | null;
}

export const DEFAULT_PLATFORM_LIST = "facebook,instagram,linkedin,x";

export function normalizePlatformName(value: string | null | undefined): SocialPlatform | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  return PLATFORM_OPTIONS.includes(normalized as SocialPlatform) ? (normalized as SocialPlatform) : null;
}

export function validateSocialStatusPayload(payload: any): ValidatedCallback {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new RequestValidationError(400, "A callback object is required.");
  const event = assertMaxString(payload.event, "Event", 128, true);
  if (event !== "content.distribution.updated") throw new RequestValidationError(400, "Invalid callback event.");
  if (payload.version !== undefined && payload.version !== 1) throw new RequestValidationError(400, "Invalid callback version.");
  const rawJobId = payload.job_id ?? payload.jobId ?? payload.id;
  if (typeof rawJobId === "string" && rawJobId.length > 32) throw new RequestValidationError(413, "Job id is too long.");
  const jobId = Number(rawJobId);
  if (!Number.isSafeInteger(jobId) || jobId <= 0) throw new RequestValidationError(400, "A valid distribution job id is required.");
  const platform = normalizePlatformName(assertMaxString(payload.platform, "Platform", 32, true));
  if (!platform) throw new RequestValidationError(400, "Unsupported platform.");
  const status = assertMaxString(payload.status, "Status", 32, true)?.toLowerCase() as PublicationStatus;
  if (!["queued", "scheduled", "published", "failed", "skipped"].includes(status)) throw new RequestValidationError(400, "Unsupported publication status.");
  const externalId = assertMaxString(payload.external_id ?? payload.externalId, "External id", 256);
  const publishUrl = assertMaxString(payload.publish_url ?? payload.publishUrl, "Publish URL", 2048);
  if (publishUrl && !isValidHttpUrl(publishUrl)) throw new RequestValidationError(400, "Publish URL must be HTTP or HTTPS.");
  const idempotencyKey = assertMaxString(payload.idempotency_key ?? payload.idempotencyKey, "Idempotency key", 256);
  assertMaxString(payload.event_id ?? payload.eventId, "Event id", 256);
  if (payload.timestamp !== undefined) assertMaxString(payload.timestamp, "Timestamp", 64, true);
  if (payload.response_payload !== undefined && (!payload.response_payload || typeof payload.response_payload !== "object" || Array.isArray(payload.response_payload))) {
    throw new RequestValidationError(400, "Response payload must be an object.");
  }
  return { jobId, platform, status, externalId, publishUrl, idempotencyKey };
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

export interface DispatchPublication {
  platform: SocialPlatform;
  publicationId: number;
}

export function buildDispatchPayload(jobId: number, article: NormalizedArticle, publications: DispatchPublication[], createdAt = new Date().toISOString()) {
  const idempotencyKey = `newssa-distribution-${jobId}`;
  return {
    event: "content.distribution.requested",
    version: 1,
    idempotency_key: idempotencyKey,
    job: {
      id: String(jobId),
      article_id: String(article.wordpressPostId),
      canonical_url: article.articleUrl,
      title: article.title,
      excerpt: article.excerpt,
      featured_image_url: article.featuredImage,
    },
    platforms: publications.map(publication => ({
      platform: publication.platform,
      publication_id: String(publication.publicationId),
    })),
    callback: {
      event: "content.distribution.updated",
      job_id: String(jobId),
    },
    created_at: createdAt,
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

export function getTimestampToleranceSeconds(): number {
  const configured = Number(process.env.CONTENT_DISTRIBUTION_TIMESTAMP_TOLERANCE_SECONDS ?? 300);
  return Number.isFinite(configured) && configured > 0 ? configured : 300;
}

export function isFreshTimestamp(timestamp: string | number, now = Date.now()): boolean {
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  return Math.abs(Math.floor(now / 1000) - timestampSeconds) <= getTimestampToleranceSeconds();
}

export function createWebhookSignature(secret: string, timestamp: string, rawBody: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex")}`;
}

export function getRawRequestBody(request: { body?: unknown; rawBody?: unknown }): string | null {
  if (typeof request.rawBody === "string") return request.rawBody;
  if (request.rawBody instanceof Uint8Array) return Buffer.from(request.rawBody).toString("utf8");
  if (typeof request.body === "string") return request.body;
  return null;
}

export function verifyWebhookSignature(
  rawBody: string,
  providedSignature: string | string[] | undefined,
  timestamp: string | number | undefined,
  now = Date.now(),
): boolean {
  const secret = getWebhookSecret();
  if (!secret || timestamp === undefined || !isFreshTimestamp(timestamp, now)) return false;
  const candidate = Array.isArray(providedSignature) ? providedSignature[0] : providedSignature;
  if (!candidate) return false;
  return constantTimeEquals(createWebhookSignature(secret, String(timestamp), rawBody), String(candidate));
}

export function buildJobErrorResponse(error: unknown) {
  return { success: false, error: "Unable to process the content distribution request." };
}

export function createEventId(): string {
  return randomBytes(16).toString("hex");
}
