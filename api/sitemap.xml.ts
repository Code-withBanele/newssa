import type { VercelRequest, VercelResponse } from "@vercel/node";
import { escapeXml, fetchAll, siteUrl } from "./_lib/seo.js";

interface SitemapPost { id: number; modified: string; status: string; }
interface SitemapCategory { slug: string; name: string; count: number; }

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const [posts, categories] = await Promise.all([
      fetchAll<SitemapPost>("/posts?status=publish&_fields=id,modified,status"),
      fetchAll<SitemapCategory>("/categories?_fields=slug,name,count"),
    ]);
    const urls = [
      { path: "/", modified: undefined },
      { path: "/about", modified: undefined },
      { path: "/category/contact", modified: undefined },
      ...categories
        .filter(category => category.count > 0 && category.slug !== "uncategorized" && category.slug !== "contact")
        .map(category => ({ path: `/category/${encodeURIComponent(category.slug)}`, modified: undefined })),
      ...posts
        .filter(post => post.status === "publish")
        .map(post => ({ path: `/article/${post.id}`, modified: post.modified })),
    ];
    const uniqueUrls = [...new Map(urls.map(url => [`${siteUrl}${url.path}`, url])).values()];
    const body = uniqueUrls.map(url => `  <url><loc>${escapeXml(`${siteUrl}${url.path}`)}</loc>${url.modified ? `<lastmod>${escapeXml(url.modified)}</lastmod>` : ""}</url>`).join("\n");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to generate sitemap." });
  }
}