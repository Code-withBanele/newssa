import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireDatabaseConfig, sql, withTransaction } from "./db.js";
import {
  buildJobErrorResponse,
  calculateJobStatus,
  getRawRequestBody,
  getWebhookSecret,
  getEnabledPlatforms,
  validateSocialStatusPayload,
  verifyWebhookSignature,
} from "./content-distribution.js";
import {
  createDistributionJob,
  fetchPublishedWordPressPosts,
  fetchPublishedWordPressPostsSince,
  fetchWordPressPost,
  isKnownWordPressPost,
  publicationCursor,
  resolvePlatforms,
  shouldAdvanceDetectorCheckpoint,
  sortPublishedPosts,
} from "./distribution-jobs.js";
import { lockWordPressPublicationDetector, readPublicationCheckpoint, writePublicationCheckpoint, type PublicationCursor } from "./automation-checkpoints.js";
import { jsonBody, method } from "./http.js";
import { assertMaxString, authorizeAutomationRequest, authorizeScheduledAutomationRequest, requireRateLimit, safeErrorResponse, RequestValidationError } from "./security.js";

const POSTS_TO_SCAN = 20;

export async function createJobHandler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;
  const authorization = authorizeAutomationRequest(req);
  if (authorization === "misconfigured") return res.status(503).json({ error: "Automation authorization is not configured." });
  if (authorization !== "authorized") return res.status(401).json({ error: "Authentication required." });
  if (!requireRateLimit(req, res, "automation-create-job", 10, 60_000)) return;

  try {
    requireDatabaseConfig();
    const body = jsonBody(req);
    const rawPostId = body.wordpressPostId ?? body.postId ?? body.id;
    if (typeof rawPostId === "string" && rawPostId.length > 20) throw new RequestValidationError(413, "WordPress post id is too long.");
    const postId = Number(rawPostId);
    if (!Number.isFinite(postId) || postId <= 0) return res.status(400).json({ error: "A valid WordPress post id is required." });

    const rawPlatforms = Array.isArray(body.platforms) ? body.platforms : undefined;
    if (rawPlatforms) {
      if (rawPlatforms.length > 4) throw new RequestValidationError(413, "Too many platforms were requested.");
      rawPlatforms.forEach(value => assertMaxString(value, "Platform", 32));
    }
    const platforms = resolvePlatforms(rawPlatforms);
    const article = await fetchWordPressPost(postId);
    const result = await createDistributionJob(article, platforms);

    return res.status(result.dispatch.success ? 201 : 503).json({
      success: result.dispatch.success,
      error: result.dispatch.success ? undefined : result.dispatch.error,
      data: {
        jobId: result.jobId,
        wordpressPostId: article.wordpressPostId,
        title: article.title,
        articleUrl: article.articleUrl,
        platforms,
        status: "queued",
        dispatch: result.dispatch,
      },
    });
  } catch (error) {
    console.error("Distribution job creation failed:", error instanceof Error ? error.message : "Unknown error");
    const response = safeErrorResponse(error, "Unable to create the distribution job.");
    return res.status(response.status).json(response.body);
  }
}

export async function detectPostsHandler(req: VercelRequest, res: VercelResponse) {
  if (!["GET", "POST"].includes(req.method ?? "")) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const authorization = authorizeScheduledAutomationRequest(req);
  if (authorization === "misconfigured") return res.status(503).json({ error: "Scheduled automation authorization is not configured." });
  if (authorization !== "authorized") return res.status(401).json({ error: "Authentication required." });
  if (!requireRateLimit(req, res, "automation-detect-posts", 4, 60_000)) return;

  try {
    const data = await withTransaction(async client => {
      await lockWordPressPublicationDetector(client);
      const checkpoint = await readPublicationCheckpoint(client);
      const configuredPlatforms = getEnabledPlatforms();
      const posts = checkpoint
        ? await fetchPublishedWordPressPostsSince(checkpoint)
        : sortPublishedPosts(await fetchPublishedWordPressPosts(POSTS_TO_SCAN));
      const knownJobs = await client.sql<{ wordpressPostId: number }>`
        SELECT wordpress_post_id AS "wordpressPostId"
        FROM content_distribution_jobs
        WHERE source = 'wordpress'
      `;
      const knownIds = new Set(knownJobs.rows.map(row => Number(row.wordpressPostId)));
      const results = { scanned: posts.length, alreadyProcessed: 0, created: 0, failed: 0, checkpoint: checkpoint?.publishedAt ?? null };
      const failures: Array<{ wordpressPostId: number; reason: string }> = [];
      let currentCursor: PublicationCursor | null = checkpoint;

      if (!checkpoint && posts.length === 0) {
        currentCursor = { publishedAt: new Date().toISOString(), postId: 0 };
        await writePublicationCheckpoint(client, currentCursor);
      }

      for (const post of posts) {
        if (isKnownWordPressPost(post.id, knownIds)) {
          results.alreadyProcessed += 1;
          currentCursor = publicationCursor(post);
          await writePublicationCheckpoint(client, currentCursor);
          continue;
        }

        try {
          const article = await fetchWordPressPost(post.id);
          const job = await createDistributionJob(article, configuredPlatforms);
          results.created += 1;
          knownIds.add(post.id);

          if (!shouldAdvanceDetectorCheckpoint(job.dispatch.success)) {
            results.failed += 1;
            failures.push({ wordpressPostId: post.id, reason: "Distribution dispatch failed after job creation." });
            break;
          }

          currentCursor = publicationCursor(post);
          await writePublicationCheckpoint(client, currentCursor);
        } catch (error) {
          results.failed += 1;
          failures.push({ wordpressPostId: post.id, reason: "Article processing failed." });
          console.error("WordPress publication detection failed", { wordpressPostId: post.id, reason: error instanceof Error ? error.message : "Unknown error" });
          break;
        }
      }

      results.checkpoint = currentCursor?.publishedAt ?? null;
      return { ...results, failures };
    });

    return res.status(200).json({ success: data.failed === 0, data });
  } catch (error) {
    console.error("WordPress publication detection failed", error instanceof Error ? error.message : "Unknown error");
    const response = safeErrorResponse(error, "Unable to detect WordPress publications.");
    return res.status(response.status).json(response.body);
  }
}

export async function socialStatusHandler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;
  if (!requireRateLimit(req, res, "automation-social-status", 60, 60_000)) return;

  try {
    requireDatabaseConfig();
    const rawBody = getRawRequestBody(req as typeof req & { rawBody?: unknown });
    const timestampHeader = req.headers["x-newssa-timestamp"];
    const timestamp = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;
    const signature = req.headers["x-newssa-signature"];
    const secret = getWebhookSecret();
    if (!secret) return res.status(503).json({ success: false, error: "Callback authentication is not configured." });
    if (!rawBody || !timestamp || !verifyWebhookSignature(rawBody, signature, timestamp)) return res.status(401).json({ success: false, error: "Invalid webhook signature." });

    let payload: any;
    try {
      payload = rawBody ? JSON.parse(rawBody) : req.body ?? {};
    } catch {
      return res.status(400).json({ success: false, error: "Invalid JSON payload." });
    }
    const { jobId, platform, status, externalId, publishUrl } = validateSocialStatusPayload(payload);
    const serializedPayload = JSON.stringify(payload);
    if (Buffer.byteLength(serializedPayload, "utf8") > 64 * 1024) throw new RequestValidationError(413, "Callback payload is too large.");

    const jobResult = await sql<{ platformList: string[] }>`
      SELECT platform_list AS "platformList"
      FROM content_distribution_jobs
      WHERE id = ${jobId}
    `;
    const job = jobResult.rows[0];
    if (!job) return res.status(404).json({ success: false, error: "Distribution job not found." });
    if (!job.platformList.includes(platform)) return res.status(403).json({ success: false, error: "Platform is not configured for this job." });

    const publicationResult = await sql`
      UPDATE content_distribution_publications
      SET status = ${status}, external_id = ${externalId}, publish_url = ${publishUrl}, response_payload = ${serializedPayload}, updated_at = NOW()
      WHERE job_id = ${jobId} AND platform = ${platform}
    `;
    if (publicationResult.rowCount === 0) return res.status(404).json({ success: false, error: "Distribution publication not found." });

    const rows = await sql<{ status: string }>`
      SELECT status FROM content_distribution_publications WHERE job_id = ${jobId}
    `;
    const nextStatus = calculateJobStatus(rows.rows.map(row => ({ platform: row.status, status: row.status })));
    await sql`UPDATE content_distribution_jobs SET status = ${nextStatus}, updated_at = NOW() WHERE id = ${jobId}`;

    return res.status(200).json({ success: true, data: { jobId, platform, status, jobStatus: nextStatus } });
  } catch (error) {
    console.error("Distribution webhook failed:", error instanceof Error ? error.message : "Unknown error");
    const response = safeErrorResponse(error, "Unable to process the distribution callback.");
    return res.status(response.status).json(response.body);
  }
}
