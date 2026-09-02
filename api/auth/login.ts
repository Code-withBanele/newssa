import { randomInt, createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, requireDatabaseConfig } from "../_lib/db";
import { verifyPassword, signChallenge } from "../_lib/auth";
import { sendVerificationCode } from "../_lib/email";
import { jsonBody, method, validEmail } from "../_lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;
  try {
    requireDatabaseConfig();
    const { email, password } = jsonBody(req);
    if (!validEmail(email) || typeof password !== "string") return res.status(400).json({ error: "Email and password are required." });
    const normalizedEmail = email.trim().toLowerCase();
    const result = await sql<{ id: number; passwordHash: string; twoFactorEnabled: boolean }>`
      SELECT id, password_hash AS "passwordHash", two_factor_enabled AS "twoFactorEnabled" FROM users WHERE email = ${normalizedEmail}
    `;
    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ error: "Invalid email or password." });
    if (!user.twoFactorEnabled) return res.status(403).json({ error: "Account setup is incomplete." });
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    await sql`UPDATE users SET verification_code_hash = ${createHash("sha256").update(code).digest("hex")}, verification_code_expires_at = NOW() + INTERVAL '10 minutes', verification_attempts = 0, updated_at = NOW() WHERE id = ${user.id}`;
    await sendVerificationCode(normalizedEmail, code);
    return res.status(200).json({ challenge: await signChallenge({ userId: user.id, purpose: "login" }) });
  } catch {
    return res.status(500).json({ error: "Unable to sign in." });
  }
}
