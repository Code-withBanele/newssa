import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, requireDatabaseConfig } from "../_lib/db";
import { getSessionUser } from "../_lib/auth";
import { jsonBody, method } from "../_lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!["GET", "POST", "DELETE"].includes(req.method ?? "")) return res.status(405).json({ error: "Method not allowed" });
  try {
    requireDatabaseConfig();
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required." });
    if (req.method === "GET") {
      const result = await sql<{ articleId: number; savedAt: string }>`SELECT article_id AS "articleId", saved_at AS "savedAt" FROM saved_articles WHERE user_id = ${user.id} ORDER BY saved_at DESC`;
      return res.status(200).json({ articles: result.rows });
    }
    const { articleId } = jsonBody(req);
    if (!Number.isInteger(articleId) || articleId < 1) return res.status(400).json({ error: "A valid WordPress article ID is required." });
    if (req.method === "POST") {
      await sql`INSERT INTO saved_articles (user_id, article_id) VALUES (${user.id}, ${articleId}) ON CONFLICT (user_id, article_id) DO NOTHING`;
      return res.status(204).end();
    }
    await sql`DELETE FROM saved_articles WHERE user_id = ${user.id} AND article_id = ${articleId}`;
    return res.status(204).end();
  } catch {
    return res.status(500).json({ error: "Saved articles service unavailable." });
  }
}
