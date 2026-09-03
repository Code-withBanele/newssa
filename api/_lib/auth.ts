import { createHash, randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { sql } from "./db";

const SESSION_COOKIE = "__Host-newssa_session";
const SESSION_DAYS = 30;

export type AuthUser = { id: number; email: string; firstName: string; lastName: string };

function sessionSecret() {
  const value = process.env.AUTH_SESSION_SECRET;
  if (!value) throw new Error("Authentication is not configured. Set AUTH_SESSION_SECRET in Vercel environment variables.");
  return new TextEncoder().encode(value);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function parseCookies(cookieHeader = "") {
  return Object.fromEntries(cookieHeader.split(";").map(part => part.trim().split("=")).filter(([key, value]) => key && value));
}

export function setSessionCookie(res: { setHeader(name: string, value: string): void }, token: string, maxAge = SESSION_DAYS * 86400) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly${secure}; SameSite=Lax`);
}

export function clearSessionCookie(res: { setHeader(name: string, value: string): void }) {
  setSessionCookie(res, "", 0);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  await sql`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (${userId}, ${hashToken(token)}, NOW() + ${SESSION_DAYS} * INTERVAL '1 day')`;
  return token;
}

export async function getSessionUser(req: { headers: { cookie?: string } }): Promise<AuthUser | null> {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const result = await sql<AuthUser>`
    SELECT u.id, u.email, u.first_name AS "firstName", u.last_name AS "lastName"
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > NOW()
  `;
  return result.rows[0] ?? null;
}

export async function deleteSession(req: { headers: { cookie?: string } }) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
}

export async function signChallenge(payload: Record<string, string | number>, expiresIn: string | number = "10m") {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiresIn).sign(sessionSecret());
}

export async function verifyChallenge(token: string) {
  return (await jwtVerify(token, sessionSecret())).payload;
}
