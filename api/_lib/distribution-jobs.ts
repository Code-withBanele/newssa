import { requireDatabaseConfig, sql, withTransaction } from "./db.js";
import {
  getEnabledPlatforms,
  normalizePlatformName,
  normalizeWordPressArticle,
  type NormalizedArticle,
  type SocialPlatform,
} from "./content-distribution.js";
import { dispatchDistributionEvent, type DispatchResult } from "./distribution-dispatch.js";

const WORDPRESS_API_BASE = (process.env.VITE_WORDPRESS_API || process.env.WORDPRESS_API || "https://newssa.co.za/wp-json/wp/v2").replace(/\/$/, "");
const WORDPRESS_REQUEST_TIMEOUT_MS = 10_000;

export interface DistributionJobResult {
  jobId: number;
  article: NormalizedArticle;
  platforms: SocialPlatform[];
  dispatch: DispatchResult;
}

export interface PublishedWordPressPost {
  id: number;
  date?: string;
  modified?: string;
  status?: string;
  link?: string;
  title?: { rendered?: string };
}

export interface WordPressPublicationCursor {
  publishedAt: string;
  postId: number;
}

function wordpressUrl(path: string) {
  return new URL(`${WORDPRESS_API_BASE}${path}`);
}

async function fetchWordPressJson(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORDPRESS_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`WordPress request returned HTTP ${response.status}.`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWordPressPost(postId: number): Promise<NormalizedArticle> {
  const url = wordpressUrl(`/posts/${postId}`);
  url.searchParams.set("_embed", "author,wp:featuredmedia,wp:term");
  const article = normalizeWordPressArticle(await fetchWordPressJson(url));
  if (!article) throw new Error("WordPress returned an invalid article.");
  return article;
}

export async function fetchPublishedWordPressPosts(limit = 20): Promise<PublishedWordPressPost[]> {
  const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const url = wordpressUrl("/posts");
  url.searchParams.set("status", "publish");
  url.searchParams.set("orderby", "date");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(boundedLimit));
  url.searchParams.set("_fields", "id,date,modified,status,link,title");
  const posts = await fetchWordPressJson(url);
  if (!Array.isArray(posts)) throw new Error("WordPress returned an invalid post list.");
  return posts.filter(post => Number.isSafeInteger(post?.id) && post.id > 0);
}

export function sortPublishedPosts(posts: PublishedWordPressPost[]): PublishedWordPressPost[] {
  return [...posts].sort((left, right) => {
    const dateDifference = new Date(left.date ?? 0).getTime() - new Date(right.date ?? 0).getTime();
    return dateDifference || left.id - right.id;
  });
}

export function publicationCursor(post: PublishedWordPressPost): WordPressPublicationCursor {
  if (!post.date || !Number.isFinite(new Date(post.date).getTime())) throw new Error("WordPress returned a post without a valid publication date.");
  return { publishedAt: new Date(post.date).toISOString(), postId: post.id };
}

export function isAfterPublicationCursor(post: PublishedWordPressPost, cursor: WordPressPublicationCursor): boolean {
  const postCursor = publicationCursor(post);
  const postTime = new Date(postCursor.publishedAt).getTime();
  const cursorTime = new Date(cursor.publishedAt).getTime();
  return postTime > cursorTime || (postTime === cursorTime && postCursor.postId > cursor.postId);
}

export async function fetchPublishedWordPressPostsSince(cursor: WordPressPublicationCursor): Promise<PublishedWordPressPost[]> {
  const after = new Date(new Date(cursor.publishedAt).getTime() - 1000).toISOString();
  const posts: PublishedWordPressPost[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = wordpressUrl("/posts");
    url.searchParams.set("status", "publish");
    url.searchParams.set("orderby", "date");
    url.searchParams.set("order", "asc");
    url.searchParams.set("after", after);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("_fields", "id,date,modified,status,link,title");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WORDPRESS_REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`WordPress request returned HTTP ${response.status}.`);
    const pagePosts = await response.json();
    if (!Array.isArray(pagePosts)) throw new Error("WordPress returned an invalid post list.");
    posts.push(...pagePosts.filter(post => Number.isSafeInteger(post?.id) && post.id > 0));
    totalPages = Number(response.headers.get("X-WP-TotalPages") || 1);
    page += 1;
  } while (page <= totalPages);

  return sortPublishedPosts(posts.filter(post => isAfterPublicationCursor(post, cursor)));
}

export function findUnprocessedWordPressPostIds(posts: PublishedWordPressPost[], knownIds: Set<number>): number[] {
  return Array.from(new Set(posts.map(post => post.id).filter(postId => !knownIds.has(postId))));
}

export function isKnownWordPressPost(postId: number, knownIds: Set<number>): boolean {
  return knownIds.has(postId);
}

export function shouldAdvanceDetectorCheckpoint(dispatchSucceeded: boolean): boolean {
  return dispatchSucceeded;
}

export function resolvePlatforms(values?: unknown): SocialPlatform[] {
  const rawPlatforms = Array.isArray(values) ? values : getEnabledPlatforms();
  if (rawPlatforms.length > 4) throw new Error("Too many platforms were requested.");
  const platforms = Array.from(new Set(rawPlatforms
    .map(value => normalizePlatformName(String(value)))
    .filter((value): value is SocialPlatform => value !== null)));
  if (!platforms.length) throw new Error("At least one enabled platform is required.");
  return platforms;
}

export async function createDistributionJob(article: NormalizedArticle, platforms: SocialPlatform[]): Promise<DistributionJobResult> {
  requireDatabaseConfig();
  const jobId = await withTransaction(async client => {
    const jobResult = await client.sql<{ id: number }>`
      INSERT INTO content_distribution_jobs (
        wordpress_post_id, source, title, slug, excerpt, article_url,
        featured_image_url, category, platform_list, status, dispatch_enabled
      ) VALUES (
        ${article.wordpressPostId}, ${article.source}, ${article.title}, ${article.slug},
        ${article.excerpt}, ${article.articleUrl}, ${article.featuredImage}, ${article.category},
        string_to_array(${platforms.join(",")}, ','), 'queued', ${false}
      )
      ON CONFLICT (wordpress_post_id, source)
      DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        excerpt = EXCLUDED.excerpt,
        article_url = EXCLUDED.article_url,
        featured_image_url = EXCLUDED.featured_image_url,
        category = EXCLUDED.category,
        platform_list = EXCLUDED.platform_list,
        updated_at = NOW()
      RETURNING id
    `;
    const createdJobId = jobResult.rows[0]?.id;
    if (!createdJobId) throw new Error("The distribution job could not be created.");

    for (const platform of platforms) {
      await client.sql`
        INSERT INTO content_distribution_publications (job_id, platform, status, publish_url)
        VALUES (${createdJobId}, ${platform}, 'queued', NULL)
        ON CONFLICT (job_id, platform)
        DO NOTHING
      `;
    }
    return createdJobId;
  });

  const publicationRows = await sql<{ platform: SocialPlatform; publicationId: number }>`
    SELECT platform, id AS "publicationId"
    FROM content_distribution_publications
    WHERE job_id = ${jobId}
    ORDER BY id
  `;
  const dispatch = await dispatchDistributionEvent(jobId, article, publicationRows.rows);
  if (!dispatch.success) {
    console.error("Content distribution job created but dispatch was not sent", {
      jobId,
      idempotencyKey: dispatch.idempotencyKey,
      error: dispatch.error,
    });
  }
  return { jobId, article, platforms, dispatch };
}
