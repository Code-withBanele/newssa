import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomInt, createHash } from "node:crypto";
import { sql, requireDatabaseConfig } from "../_lib/db";
import { hashPassword, signChallenge } from "../_lib/auth";
import { requireEmailConfig, sendVerificationCode } from "../_lib/email";
import { jsonBody, method, validEmail } from "../_lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;
  let createdUserId: number | null = null;
  try {
    requireDatabaseConfig();
    const { email, firstName, lastName, password } = jsonBody(req);
    if (!validEmail(email) || typeof firstName !== "string" || typeof lastName !== "string" || typeof password !== "string" || password.length < 12) {
      return res.status(400).json({ error: "Provide a valid email, name, and password of at least 12 characters." });
    }
    requireEmailConfig();
    const normalizedEmail = email.trim().toLowerCase();
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    const codeHash = createHash("sha256").update(code).digest("hex");
    const passwordHash = await hashPassword(password);
    const result = await sql<{ id: number }>`
      INSERT INTO users (email, first_name, last_name, password_hash, verification_code_hash, verification_code_expires_at)
      VALUES (${normalizedEmail}, ${firstName.trim()}, ${lastName.trim()}, ${passwordHash}, ${codeHash}, NOW() + INTERVAL '10 minutes')
      RETURNING id
    `;
    createdUserId = result.rows[0].id;
    await sendVerificationCode(normalizedEmail, code);
    const challenge = await signChallenge({ userId: result.rows[0].id, purpose: "registration" }, "30m");
    return res.status(201).json({ challenge });
  } catch (error) {
    if (error instanceof Error && /duplicate key|unique/i.test(error.message)) return res.status(409).json({ error: "An account with that email already exists." });
    if (error instanceof Error && error.name === "EmailDeliveryError") {
      if (createdUserId !== null) await sql`DELETE FROM users WHERE id = ${createdUserId} AND email_verified = FALSE`;
      return res.status(503).json({ error: "Email delivery is temporarily unavailable." });
    }
    console.error("Registration failed:", error instanceof Error ? error.message : "Unknown error");
    return res.status(500).json({ error: "Unable to create account." });
  }
}
