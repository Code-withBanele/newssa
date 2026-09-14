import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireDatabaseConfig, withTransaction } from "../_lib/db.js";
import {
  getEnabledPlatforms,
  buildJobErrorResponse,
  normalizeWordPressArticle,
  type SocialPlatform,
} from "../_lib/content-distribution.js";
import { jsonBody, method } from "../_lib/http.js";

const WORDPRESS_API_BASE = (process.env.VITE_WORDPRESS_API || process.env.WORDPRESS_API || "https://newssa.co.za/wp-json/wp/v2").replace(/\/$/, "");

async function fetchWordPressPost(postId: number) {
  const url = new URL(`${WORDPRESS_API_BASE}/posts/${postId}`);
  url.searchParams.set("_embed", "author,wp:featuredmedia,wp:term");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`WordPress API returned ${response.status} for post ${postId}.`);
  }

  const payload = await response.json();
  const article = normalizeWordPressArticle(payload);
  if (!article) {
    throw new Error(`WordPress post ${postId} could not be normalized.`);
  }

  return article;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;

  try {
    requireDatabaseConfig();
    const body = jsonBody(req);
    const rawPostId = body.wordpressPostId ?? body.postId ?? body.id;
    const postId = Number(rawPostId);

    if (!Number.isFinite(postId) || postId <= 0) {
      return res.status(400).json({ error: "A valid WordPress post id is required." });
    }

    const rawPlatforms = Array.isArray(body.platforms) ? body.platforms : getEnabledPlatforms();
    const platforms = rawPlatforms
      .map(value => String(value).trim().toLowerCase())
      .filter(Boolean)
      .filter((value): value is SocialPlatform => ["facebook", "instagram", "linkedin", "x"].includes(value));

    if (!platforms.length) {
      return res.status(400).json({ error: "At least one enabled platform is required." });
    }

    const article = await fetchWordPressPost(postId);
    const jobId = await withTransaction(async client => {
      const jobResult = await client.sql<{ id: number }>`
      INSERT INTO content_distribution_jobs (
        wordpress_post_id,
        source,
        title,
        slug,
        excerpt,
        article_url,
        featured_image_url,
        category,
        platform_list,
        status,
        dispatch_enabled
      ) VALUES (
        ${article.wordpressPostId},
        ${article.source},
        ${article.title},
        ${article.slug},
        ${article.excerpt},
        ${article.articleUrl},
        ${article.featuredImage},
        ${article.category},
        ${platforms},
        'queued',
        ${false}
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
          DO UPDATE SET
            status = EXCLUDED.status,
            updated_at = NOW()
        `;
      }

      return createdJobId;
    });

    return res.status(201).json({
      success: true,
      data: {
        jobId,
        wordpressPostId: article.wordpressPostId,
        title: article.title,
        articleUrl: article.articleUrl,
        platforms,
        status: "queued",
        dispatchEnabled: false,
      },
    });
  } catch (error) {
    console.error("Distribution job creation failed:", error instanceof Error ? error.message : "Unknown error");
    return res.status(500).json(buildJobErrorResponse(error));
  }
}
