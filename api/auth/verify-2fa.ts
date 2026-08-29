import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verify } from "otplib";
import { sql, requireDatabaseConfig } from "../_lib/db";
import { decryptSecret } from "../_lib/crypto";
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
    const result = await sql<{ id: number; email: string; firstName: string; lastName: string; secret: string; twoFactorEnabled: boolean }>`
      SELECT id, email, first_name AS "firstName", last_name AS "lastName", two_factor_secret_encrypted AS secret, two_factor_enabled AS "twoFactorEnabled"
      FROM users WHERE id = ${Number(claims.userId)}
    `;
    const user = result.rows[0];
    if (!user?.secret || (claims.purpose === "registration" && user.twoFactorEnabled)) return res.status(400).json({ error: "Invalid verification challenge." });
    if (!(await verify({ secret: decryptSecret(user.secret), token: String(token) })).valid) return res.status(401).json({ error: "Invalid verification code." });
    await sql`UPDATE users SET email_verified = TRUE, two_factor_enabled = TRUE, updated_at = NOW(), last_login_at = NOW() WHERE id = ${user.id}`;
    const session = await createSession(user.id);
    setSessionCookie(res, session);
    return res.status(200).json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
  } catch {
    return res.status(401).json({ error: "Verification failed." });
  }
}
