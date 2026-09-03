import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomInt, createHash } from "node:crypto";
import { sql, requireDatabaseConfig } from "../_lib/db";
import { signChallenge, verifyChallenge } from "../_lib/auth";
import { sendVerificationCode } from "../_lib/email";
import { jsonBody, method } from "../_lib/http";

const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_OTP_TEMPLATE_ID = "8864c140-a061-44e6-bf2c-f81190eca3cc";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;
  try {
    requireDatabaseConfig();
    const { challenge } = jsonBody(req);
    if (typeof challenge !== "string") return res.status(400).json({ error: "Unable to resend verification code." });
    const claims = await verifyChallenge(challenge);
    if (claims.purpose !== "registration" && claims.purpose !== "login") return res.status(400).json({ error: "Unable to resend verification code." });

    const result = await sql<{ id: number; email: string; twoFactorEnabled: boolean; codeHash: string | null; updatedAt: string }>`
      SELECT id, email, two_factor_enabled AS "twoFactorEnabled", verification_code_hash AS "codeHash", updated_at AS "updatedAt"
      FROM users WHERE id = ${Number(claims.userId)}
    `;
    const user = result.rows[0];
    if (!user || !user.codeHash || (claims.purpose === "registration" && user.twoFactorEnabled) || (claims.purpose === "login" && !user.twoFactorEnabled)) {
      return res.status(400).json({ error: "Unable to resend verification code." });
    }
    if (new Date(user.updatedAt).getTime() > Date.now() - RESEND_COOLDOWN_SECONDS * 1000) {
      return res.status(429).json({ error: "Please wait before requesting another code." });
    }

    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    await sql`
      UPDATE users
      SET verification_code_hash = ${createHash("sha256").update(code).digest("hex")},
          verification_code_expires_at = NOW() + INTERVAL '10 minutes',
          verification_attempts = 0,
          updated_at = NOW()
      WHERE id = ${user.id}
    `;
    await sendVerificationCode(user.email, code, RESEND_OTP_TEMPLATE_ID);
    return res.status(200).json({ challenge: await signChallenge({ userId: user.id, purpose: claims.purpose as string }, "30m") });
  } catch (error) {
    if (error instanceof Error && error.name === "EmailDeliveryError") return res.status(503).json({ error: "Email delivery is temporarily unavailable." });
    return res.status(400).json({ error: "Unable to resend verification code." });
  }
}