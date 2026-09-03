import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomInt, createHash } from "node:crypto";
import { sql, requireDatabaseConfig } from "../_lib/db";
import { signChallenge } from "../_lib/auth";
import { requireEmailConfig, sendVerificationCode } from "../_lib/email";
import { jsonBody, method, validEmail } from "../_lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;
  try {
    requireDatabaseConfig();
    requireEmailConfig();
    const { email } = jsonBody(req);
    if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });

    const normalizedEmail = email.trim().toLowerCase();
    const result = await sql<{ id: number; email: string; twoFactorEnabled: boolean }>`
      SELECT id, email, two_factor_enabled AS "twoFactorEnabled" FROM users WHERE email = ${normalizedEmail}
    `;
    const user = result.rows[0];
    if (user) {
      const code = String(randomInt(0, 1000000)).padStart(6, "0");
      await sql`
        UPDATE users SET verification_code_hash = ${createHash("sha256").update(code).digest("hex")},
        verification_code_expires_at = NOW() + INTERVAL '10 minutes', verification_attempts = 0, updated_at = NOW()
        WHERE id = ${user.id}
      `;
      await sendVerificationCode(user.email, code);
      const challenge = await signChallenge({ userId: user.id, purpose: "password-reset" }, "30m");
      return res.status(200).json({ challenge });
    }

    return res.status(200).json({ message: "If an account exists for that email, a verification code has been sent." });
  } catch (error) {
    if (error instanceof Error && error.name === "EmailDeliveryError") return res.status(503).json({ error: "Email delivery is temporarily unavailable." });
    return res.status(500).json({ error: "Unable to process the password reset request." });
  }
}