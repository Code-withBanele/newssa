import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateSecret, generateURI } from "otplib";
import { sql, requireDatabaseConfig } from "../_lib/db";
import { encryptSecret } from "../_lib/crypto";
import { hashPassword, signChallenge } from "../_lib/auth";
import { jsonBody, method, validEmail } from "../_lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;
  try {
    requireDatabaseConfig();
    const { email, firstName, lastName, password } = jsonBody(req);
    if (!validEmail(email) || typeof firstName !== "string" || typeof lastName !== "string" || typeof password !== "string" || password.length < 12) {
      return res.status(400).json({ error: "Provide a valid email, name, and password of at least 12 characters." });
    }
    const secret = generateSecret();
    const passwordHash = await hashPassword(password);
    const result = await sql<{ id: number }>`
      INSERT INTO users (email, first_name, last_name, password_hash, two_factor_secret_encrypted)
      VALUES (${email.trim().toLowerCase()}, ${firstName.trim()}, ${lastName.trim()}, ${passwordHash}, ${encryptSecret(secret)})
      RETURNING id
    `;
    const challenge = await signChallenge({ userId: result.rows[0].id, purpose: "registration" });
    return res.status(201).json({ challenge, otpAuthUri: generateURI({ issuer: "NewsSA", label: email.trim().toLowerCase(), secret }) });
  } catch (error) {
    if (error instanceof Error && /duplicate key|unique/i.test(error.message)) return res.status(409).json({ error: "An account with that email already exists." });
    return res.status(500).json({ error: "Unable to create account." });
  }
}
