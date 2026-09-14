import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, requireDatabaseConfig } from "../_lib/db.js";
import {
  buildJobErrorResponse,
  calculateJobStatus,
  getWebhookSecret,
  verifyWebhookSignature,
} from "../_lib/content-distribution.js";
import { method } from "../_lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;

  try {
    requireDatabaseConfig();

    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    const signature = req.headers["x-signature"] ?? req.headers["x-webhook-signature"] ?? req.headers["x-content-distribution-signature"];

    const secret = getWebhookSecret();
    if (secret && !verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ success: false, error: "Invalid webhook signature." });
    }

    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    const jobId = Number(payload.job_id ?? payload.jobId ?? payload.id);
    const platform = String(payload.platform ?? "").trim().toLowerCase();
    const status = String(payload.status ?? "").trim().toLowerCase();
    const externalId = payload.external_id ?? payload.externalId ?? null;
    const publishUrl = payload.publish_url ?? payload.publishUrl ?? null;

    if (!Number.isFinite(jobId) || jobId <= 0) {
      return res.status(400).json({ success: false, error: "A valid distribution job id is required." });
    }

    if (!platform) {
      return res.status(400).json({ success: false, error: "A platform name is required." });
    }

    const allowedPlatforms = ["facebook", "instagram", "linkedin", "x"];
    if (!allowedPlatforms.includes(platform)) {
      return res.status(400).json({ success: false, error: "Unsupported platform." });
    }

    if (!status) {
      return res.status(400).json({ success: false, error: "A publication status is required." });
    }

    const validStatuses = ["queued", "scheduled", "published", "failed", "skipped"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: "Unsupported publication status." });
    }

    await sql`
      INSERT INTO content_distribution_publications (job_id, platform, status, external_id, publish_url, response_payload, updated_at)
      VALUES (${jobId}, ${platform}, ${status}, ${externalId}, ${publishUrl}, ${JSON.stringify(payload)}, NOW())
      ON CONFLICT (job_id, platform)
      DO UPDATE SET
        status = EXCLUDED.status,
        external_id = EXCLUDED.external_id,
        publish_url = EXCLUDED.publish_url,
        response_payload = EXCLUDED.response_payload,
        updated_at = NOW()
    `;

    const rows = await sql<{ status: string }>`
      SELECT status FROM content_distribution_publications WHERE job_id = ${jobId}
    `;
    const nextStatus = calculateJobStatus(rows.rows.map(row => ({ platform: row.status, status: row.status })));

    await sql`
      UPDATE content_distribution_jobs
      SET status = ${nextStatus}, updated_at = NOW()
      WHERE id = ${jobId}
    `;

    return res.status(200).json({
      success: true,
      data: {
        jobId,
        platform,
        status,
        jobStatus: nextStatus,
      },
    });
  } catch (error) {
    console.error("Distribution webhook failed:", error instanceof Error ? error.message : "Unknown error");
    return res.status(500).json(buildJobErrorResponse(error));
  }
}
