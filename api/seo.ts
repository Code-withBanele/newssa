import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildRobotsTxt, buildSitemapXml, fetchAll, siteUrl } from "./_lib/seo.js";
import type { SitemapCategory, SitemapPost } from "./_lib/seo.js";

export function resolveSeoRoute(req: VercelRequest) {
  const route = req.query.route;
  return Array.isArray(route) ? route[0] : route;
}

function robots(res: VercelResponse) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  return res.status(200).send(buildRobotsTxt());
}

async function sitemap(res: VercelResponse) {
  try {
    const [posts, categories] = await Promise.all([
      fetchAll<SitemapPost>("/posts?status=publish&_fields=id,slug,modified_gmt,status"),
      fetchAll<SitemapCategory>("/categories?_fields=slug,count"),
    ]);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).send(buildSitemapXml(posts, categories));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sitemap generation error.";
    console.error("Sitemap generation failed:", message.replace(/https?:\/\/\S+/gi, "[redacted URL]"));
    return res.status(500).json({ error: "Unable to generate sitemap." });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (resolveSeoRoute(req) === "robots") return robots(res);
  if (resolveSeoRoute(req) === "sitemap") return sitemap(res);
  return res.status(404).json({ error: "SEO route not found." });
}
