import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchPostBySlug } from "../src/api/posts";
import seoHandler from "../api/seo";
import { buildRobotsTxt, buildSitemapEntries, buildSitemapXml, escapeXml, fetchAll } from "../api/_lib/seo";
import { articlePath, parseArticleRouteSegment } from "../src/utils/articleRouting";
import type { VercelRequest, VercelResponse } from "@vercel/node";

test("legacy numeric article URLs remain ID routes", () => {
  assert.deepEqual(parseArticleRouteSegment("5738"), { id: 5738 });
});

test("article slugs parse and produce encoded canonical paths", () => {
  assert.deepEqual(parseArticleRouteSegment("example-article-slug"), { slug: "example-article-slug" });
  assert.deepEqual(parseArticleRouteSegment("news%20today"), { slug: "news today" });
  assert.equal(articlePath({ id: 5738, slug: "example article" }), "/article/example%20article");
});

test("numeric and unusable slugs deliberately fall back to the ID route", () => {
  assert.deepEqual(parseArticleRouteSegment("5738"), { id: 5738 });
  assert.equal(articlePath({ id: 5738, slug: "5738" }), "/article/5738");
  assert.equal(articlePath({ id: 5738, slug: "invalid/slug" }), "/article/5738");
  assert.equal(parseArticleRouteSegment("%E0%A4%A"), null);
});

test("slug lookup returns only the exact published WordPress record", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: URL[] = [];
  globalThis.fetch = async input => {
    requestedUrls.push(new URL(String(input)));
    const slug = requestedUrls[requestedUrls.length - 1].searchParams.get("slug");
    const records = [
      { id: 10, slug: "other-story", status: "publish" },
      { id: 11, slug: "matching-story", status: "publish" },
      { id: 12, slug: "draft-story", status: "draft" },
    ];
    return new Response(JSON.stringify(records.filter(record => record.slug === slug)), {
      headers: { "X-WP-Total": "1", "X-WP-TotalPages": "1" },
    });
  };

  try {
    const match = await fetchPostBySlug("matching-story");
    assert.equal(match?.id, 11);
    assert.equal(requestedUrls[0].searchParams.get("slug"), "matching-story");
    assert.equal(await fetchPostBySlug("missing-story"), null);
    assert.equal(await fetchPostBySlug("draft-story"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sitemap uses unique canonical published article URLs with safe modification dates", () => {
  const entries = buildSitemapEntries([
    { id: 10, slug: "first-story", modified_gmt: "2026-10-14T12:00:00", status: "publish" },
    { id: 11, slug: "first-story", modified_gmt: "invalid", status: "publish" },
    { id: 12, slug: "", modified_gmt: "invalid", status: "publish" },
    { id: 13, slug: "draft-story", status: "draft" },
    { id: 0, slug: "invalid-record", status: "publish" },
  ], [
    { slug: "news", count: 4 },
    { slug: "empty-category", count: 0 },
    { slug: "uncategorized", count: 5 },
    { slug: "contact", count: 1 },
  ]);
  const paths = entries.map(entry => entry.path);

  assert.equal(paths.filter(path => path === "/article/first-story").length, 1);
  assert.ok(paths.includes("/article/12"));
  assert.ok(paths.includes("/category/news"));
  assert.ok(!paths.includes("/category/empty-category"));
  assert.ok(!paths.includes("/category/uncategorized"));
  assert.ok(!paths.includes("/article/draft-story"));
  assert.equal(entries.find(entry => entry.path === "/article/first-story")?.lastmod, "2026-10-14T12:00:00.000Z");
  assert.equal(entries.find(entry => entry.path === "/article/12")?.lastmod, undefined);
});

test("sitemap XML and robots output use the canonical origin and escape XML values", () => {
  const sitemap = buildSitemapXml([{ id: 20, slug: "canonical-story", status: "publish" }], []);
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(sitemap, /<loc>https:\/\/newssa\.co\.za\/article\/canonical-story<\/loc>/);
  assert.match(sitemap, /<\/urlset>$/);
  assert.equal(escapeXml(`a&<'">`), "a&amp;&lt;&apos;&quot;&gt;");
  assert.match(buildRobotsTxt(), /Sitemap: https:\/\/newssa\.co\.za\/sitemap\.xml/);
});

test("WordPress sitemap fetching follows pagination and fails on a broken later page", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiUrl = process.env.VITE_WORDPRESS_API;
  process.env.VITE_WORDPRESS_API = "https://cms.example.test/wp-json/wp/v2";
  const requestedPages: number[] = [];
  globalThis.fetch = async input => {
    const page = Number(new URL(String(input)).searchParams.get("page"));
    requestedPages.push(page);
    if (page === 2) return new Response("Upstream unavailable", { status: 503 });
    return new Response(JSON.stringify([{ id: 1 }]), {
      headers: { "X-WP-TotalPages": "2" },
    });
  };

  try {
    await assert.rejects(fetchAll<{ id: number }>("/posts"), /status 503/);
    assert.deepEqual(requestedPages, [1, 2]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiUrl === undefined) delete process.env.VITE_WORDPRESS_API;
    else process.env.VITE_WORDPRESS_API = originalApiUrl;
  }
});

test("SEO handler returns the required sitemap and robots content types", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    const posts = url.pathname.endsWith("/posts");
    return new Response(JSON.stringify(posts
      ? [{ id: 25, slug: "published-story", status: "publish", modified_gmt: "2026-10-15T12:00:00Z" }]
      : []), {
      headers: { "X-WP-TotalPages": "1" },
    });
  };
  const createResponse = () => {
    const response = {
      headers: {} as Record<string, string>,
      statusCode: 0,
      body: "",
      setHeader(name: string, value: string) { this.headers[name] = value; return this; },
      status(code: number) { this.statusCode = code; return this; },
      send(body: string) { this.body = body; return this; },
      json(body: unknown) { this.body = JSON.stringify(body); return this; },
    };
    return response;
  };

  try {
    const sitemapResponse = createResponse();
    await seoHandler({ query: { route: "sitemap" } } as VercelRequest, sitemapResponse as unknown as VercelResponse);
    assert.equal(sitemapResponse.statusCode, 200);
    assert.equal(sitemapResponse.headers["Content-Type"], "application/xml; charset=utf-8");
    assert.match(sitemapResponse.body, /https:\/\/newssa\.co\.za\/article\/published-story/);

    const robotsResponse = createResponse();
    await seoHandler({ query: { route: "robots" } } as VercelRequest, robotsResponse as unknown as VercelResponse);
    assert.equal(robotsResponse.statusCode, 200);
    assert.equal(robotsResponse.headers["Content-Type"], "text/plain; charset=utf-8");
    assert.match(robotsResponse.body, /Sitemap: https:\/\/newssa\.co\.za\/sitemap\.xml/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
