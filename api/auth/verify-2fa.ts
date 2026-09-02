import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "node:crypto";
import { sql, requireDatabaseConfig } from "../_lib/db";
import { createSession, setSessionCookie, verifyChallenge } from "../_lib/auth";
import { jsonBody, method } from "../_lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;
  try {
    requireDatabaseConfig();
    const { challenge, token } = jsonBody(req);
    if (typeof challenge !== "string" || !/^\d{6}$/.test(String(token))) return res.status(400).json({ error: "A valid verification code is required." });
    const claims = await verifyChallenge(challenge);
    if (claims.purpose !== "registration" && claims.purpose !== "login") return res.status(400).json({ error: "Invalid verification challenge." });
    const result = await sql<{ id: number; email: string; firstName: string; lastName: string; codeHash: string; codeExpiresAt: string; attempts: number; twoFactorEnabled: boolean }>`
      SELECT id, email, first_name AS "firstName", last_name AS "lastName", verification_code_hash AS "codeHash", verification_code_expires_at AS "codeExpiresAt", verification_attempts AS attempts, two_factor_enabled AS "twoFactorEnabled"
      FROM users WHERE id = ${Number(claims.userId)}
    `;
    const user = result.rows[0];
    if (!user?.codeHash || (claims.purpose === "registration" && user.twoFactorEnabled)) return res.status(400).json({ error: "Invalid verification challenge." });
    if (user.attempts >= 5) return res.status(429).json({ error: "Too many verification attempts. Request a new code." });
    if (new Date(user.codeExpiresAt).getTime() <= Date.now()) return res.status(401).json({ error: "That verification code has expired. Please request a new code." });
    const tokenHash = createHash("sha256").update(String(token)).digest("hex");
    if (tokenHash !== user.codeHash) {
      await sql`UPDATE users SET verification_attempts = verification_attempts + 1 WHERE id = ${user.id}`;
      return res.status(401).json({ error: "That verification code is incorrect." });
    }
    await sql`UPDATE users SET email_verified = TRUE, two_factor_enabled = TRUE, verification_code_hash = NULL, verification_code_expires_at = NULL, verification_attempts = 0, updated_at = NOW(), last_login_at = NOW() WHERE id = ${user.id}`;
    const session = await createSession(user.id);
    setSessionCookie(res, session);
    return res.status(200).json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
  } catch {
    return res.status(401).json({ error: "Verification failed." });
  }
}
