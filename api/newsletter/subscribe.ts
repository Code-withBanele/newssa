import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, requireDatabaseConfig } from "../_lib/db.js";
import { getSessionUser } from "../_lib/auth.js";
import { jsonBody, method, validEmail } from "../_lib/http.js";
import { assertMaxString, requireRateLimit, RequestValidationError } from "../_lib/security.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;
  if (!requireRateLimit(req, res, "newsletter-subscribe", 10, 60_000)) return;
  try {
    requireDatabaseConfig();
    const { email } = jsonBody(req);
    assertMaxString(email, "Email", 254, true);
    if (!validEmail(email)) return res.status(400).json({ error: "A valid email address is required." });
    const user = await getSessionUser(req);
    await sql`
      INSERT INTO newsletter_subscribers (email, user_id) VALUES (${email.trim().toLowerCase()}, ${user?.id ?? null})
      ON CONFLICT (email) WHERE status = 'active' DO UPDATE SET user_id = COALESCE(newsletter_subscribers.user_id, EXCLUDED.user_id), updated_at = NOW()
    `;
    return res.status(204).end();
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(error.statusCode).json({ error: error.message });
    return res.status(500).json({ error: "Newsletter subscription unavailable." });
  }
}
