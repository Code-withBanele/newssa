import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, requireDatabaseConfig } from "../_lib/db";
import { verifyPassword, signChallenge } from "../_lib/auth";
import { jsonBody, method, validEmail } from "../_lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;
  try {
    requireDatabaseConfig();
    const { email, password } = jsonBody(req);
    if (!validEmail(email) || typeof password !== "string") return res.status(400).json({ error: "Email and password are required." });
    const result = await sql<{ id: number; passwordHash: string; twoFactorEnabled: boolean }>`
      SELECT id, password_hash AS "passwordHash", two_factor_enabled AS "twoFactorEnabled" FROM users WHERE email = ${email.trim().toLowerCase()}
    `;
    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ error: "Invalid email or password." });
    if (!user.twoFactorEnabled) return res.status(403).json({ error: "Account setup is incomplete." });
    return res.status(200).json({ challenge: await signChallenge({ userId: user.id, purpose: "login" }) });
  } catch {
    return res.status(500).json({ error: "Unable to sign in." });
  }
}
