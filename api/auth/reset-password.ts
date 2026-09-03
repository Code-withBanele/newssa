import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "node:crypto";
import { sql, requireDatabaseConfig } from "../_lib/db";
import { hashPassword, verifyChallenge } from "../_lib/auth";
import { jsonBody, method } from "../_lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;
  try {
    requireDatabaseConfig();
    const { challenge, token, password } = jsonBody(req);
    if (typeof challenge !== "string" || !/^\d{6}$/.test(String(token)) || typeof password !== "string" || password.length < 12) {
      return res.status(400).json({ error: "Enter a valid code and a password of at least 12 characters." });
    }
    const claims = await verifyChallenge(challenge);
    if (claims.purpose !== "password-reset") return res.status(400).json({ error: "Invalid password reset request." });
    const result = await sql<{ id: number; codeHash: string | null; codeExpiresAt: string | null; attempts: number }>`
      SELECT id, verification_code_hash AS "codeHash", verification_code_expires_at AS "codeExpiresAt", verification_attempts AS attempts
      FROM users WHERE id = ${Number(claims.userId)}
    `;
    const user = result.rows[0];
    if (!user?.codeHash || !user.codeExpiresAt) return res.status(400).json({ error: "Invalid password reset request." });
    if (user.attempts >= 5) return res.status(429).json({ error: "Too many attempts. Request a new code." });
    if (new Date(user.codeExpiresAt).getTime() <= Date.now()) return res.status(401).json({ error: "That verification code has expired. Request a new code." });
    const tokenHash = createHash("sha256").update(String(token)).digest("hex");
    if (tokenHash !== user.codeHash) {
      await sql`UPDATE users SET verification_attempts = verification_attempts + 1 WHERE id = ${user.id}`;
      return res.status(401).json({ error: "That verification code is incorrect." });
    }
    const passwordHash = await hashPassword(password);
    await sql`UPDATE users SET password_hash = ${passwordHash}, verification_code_hash = NULLNPM , verification_code_expires_at = NULL, verification_attempts = 0, updated_at = NOW() WHERE id = ${user.id}`;
    await sql`DELETE FROM sessions WHERE user_id = ${user.id}`;
    return res.status(204).end();
  } catch {
    return res.status(400).json({ error: "Unable to reset password." });
  }
}