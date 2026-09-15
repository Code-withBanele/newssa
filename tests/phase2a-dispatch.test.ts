import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  buildDispatchPayload,
  createWebhookSignature,
  isFreshTimestamp,
  verifyWebhookSignature,
  validateSocialStatusPayload,
  isValidHttpUrl,
  type NormalizedArticle,
} from "../api/_lib/content-distribution.ts";
import { dispatchDistributionEvent } from "../api/_lib/distribution-dispatch.ts";
import { fetchPublishedWordPressPosts, fetchPublishedWordPressPostsSince, findUnprocessedWordPressPostIds, isAfterPublicationCursor, isKnownWordPressPost, shouldAdvanceDetectorCheckpoint, sortPublishedPosts } from "../api/_lib/distribution-jobs.ts";
import { authorizeAutomationRequest, requireRateLimit, RequestValidationError } from "../api/_lib/security.ts";
import { jsonBody } from "../api/_lib/http.ts";
import { resolveAutomationAction } from "../api/automation.ts";
import { resolveSeoRoute } from "../api/seo.ts";

const article: NormalizedArticle = {
  wordpressPostId: 42,
  title: "Phase 2A test article",
  slug: "phase-2a-test-article",
  excerpt: "A test excerpt.",
  contentHtml: "<p>Test</p>",
  contentText: "Test",
  articleUrl: "https://newssa.co.za/test/phase-2a",
  publishedAt: "2026-09-15T00:00:00.000Z",
  modifiedAt: "2026-09-15T00:00:00.000Z",
  author: "NewsSA",
  category: null,
  tags: [],
  featuredImage: "https://example.com/image.jpg",
  source: "wordpress",
};

const publications = [
  { platform: "facebook" as const, publicationId: 101 },
  { platform: "x" as const, publicationId: 102 },
];

function setEnvironment(values: Record<string, string | undefined>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test("builds the exact Zapier Phase 2A payload", () => {
  const payload = buildDispatchPayload(7, article, publications, "2026-09-15T00:00:00.000Z");
  assert.deepEqual(payload, {
    event: "content.distribution.requested",
    version: 1,
    idempotency_key: "newssa-distribution-7",
    job: {
      id: "7",
      article_id: "42",
      canonical_url: article.articleUrl,
      title: article.title,
      excerpt: article.excerpt,
      featured_image_url: article.featuredImage,
    },
    platforms: [
      { platform: "facebook", publication_id: "101" },
      { platform: "x", publication_id: "102" },
    ],
    callback: { event: "content.distribution.updated", job_id: "7" },
    created_at: "2026-09-15T00:00:00.000Z",
  });
});

test("generates and verifies timestamp-prefixed HMAC signatures", () => {
  const restore = setEnvironment({ CONTENT_DISTRIBUTION_WEBHOOK_SECRET: "phase2a-secret", CONTENT_DISTRIBUTION_TIMESTAMP_TOLERANCE_SECONDS: "300" });
  try {
    const rawBody = JSON.stringify({ event: "test", value: 1 });
    const timestamp = "1780000000";
    const expected = `sha256=${createHmac("sha256", "phase2a-secret").update(`${timestamp}.${rawBody}`).digest("hex")}`;
    assert.equal(createWebhookSignature("phase2a-secret", timestamp, rawBody), expected);
    assert.equal(verifyWebhookSignature(rawBody, expected, timestamp, Number(timestamp) * 1000), true);
    assert.equal(verifyWebhookSignature(rawBody, `${expected}x`, timestamp, Number(timestamp) * 1000), false);
  } finally {
    restore();
  }
});

test("rejects stale, future, and missing-secret signatures", () => {
  const restore = setEnvironment({ CONTENT_DISTRIBUTION_WEBHOOK_SECRET: "phase2a-secret", CONTENT_DISTRIBUTION_TIMESTAMP_TOLERANCE_SECONDS: "300" });
  try {
    const now = 1780000000000;
    const current = String(Math.floor(now / 1000));
    assert.equal(isFreshTimestamp(current, now), true);
    assert.equal(isFreshTimestamp(String(Number(current) - 301), now), false);
    assert.equal(isFreshTimestamp(String(Number(current) + 301), now), false);
    assert.equal(verifyWebhookSignature("{}", undefined, current, now), false);
  } finally {
    restore();
  }
});

test("does not send while dispatch is disabled", async () => {
  const restore = setEnvironment({ CONTENT_DISTRIBUTION_DISPATCH_ENABLED: "false", CONTENT_DISTRIBUTION_WEBHOOK_SECRET: undefined, CONTENT_DISTRIBUTION_WEBHOOK_URL: undefined });
  try {
    let called = false;
    const result = await dispatchDistributionEvent(7, article, publications, { fetcher: async () => { called = true; return new Response(null, { status: 200 }); } });
    assert.deepEqual(result, { success: true, dispatched: false, idempotencyKey: "newssa-distribution-7" });
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test("fails safely when enabled configuration is incomplete", async () => {
  const restore = setEnvironment({ CONTENT_DISTRIBUTION_DISPATCH_ENABLED: "true", CONTENT_DISTRIBUTION_WEBHOOK_SECRET: "phase2a-secret", CONTENT_DISTRIBUTION_WEBHOOK_URL: undefined });
  try {
    const result = await dispatchDistributionEvent(7, article, publications);
    assert.equal(result.success, false);
    assert.equal(result.retryable, false);
    assert.equal(result.dispatched, false);
  } finally {
    restore();
  }
});

test("sends one exact raw body with signed headers and stable idempotency", async () => {
  const restore = setEnvironment({ CONTENT_DISTRIBUTION_DISPATCH_ENABLED: "true", CONTENT_DISTRIBUTION_WEBHOOK_SECRET: "phase2a-secret", CONTENT_DISTRIBUTION_WEBHOOK_URL: "https://example.com/hook" });
  try {
    let request: Request | undefined;
    const result = await dispatchDistributionEvent(7, article, publications, {
      now: () => new Date("2026-09-15T00:00:00.000Z"),
      fetcher: async (_url, init) => {
        request = new Request("https://example.com/hook", init);
        return new Response(null, { status: 200 });
      },
    });
    assert.equal(result.success, true);
    assert.equal(result.idempotencyKey, "newssa-distribution-7");
    assert.equal(request?.headers.get("X-NewsSA-Timestamp"), "1789430400");
    const rawBody = await request!.text();
    assert.equal(request!.headers.get("X-NewsSA-Signature"), createWebhookSignature("phase2a-secret", "1789430400", rawBody));
    assert.equal(JSON.parse(rawBody).event, "content.distribution.requested");
  } finally {
    restore();
  }
});

test("returns retryable results for timeout and network failure", async () => {
  const restore = setEnvironment({ CONTENT_DISTRIBUTION_DISPATCH_ENABLED: "true", CONTENT_DISTRIBUTION_WEBHOOK_SECRET: "phase2a-secret", CONTENT_DISTRIBUTION_WEBHOOK_URL: "https://example.com/hook", CONTENT_DISTRIBUTION_WEBHOOK_TIMEOUT_MS: "5" });
  try {
    const timeout = await dispatchDistributionEvent(7, article, publications, {
      fetcher: (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }),
    });
    assert.equal(timeout.retryable, true);
    assert.match(timeout.error ?? "", /timed out/);

    const network = await dispatchDistributionEvent(7, article, publications, { fetcher: async () => { throw new Error("network down"); } });
    assert.equal(network.retryable, true);
  } finally {
    restore();
  }
});

test("requires the configured server-side automation token", () => {
  const restore = setEnvironment({ CONTENT_DISTRIBUTION_ADMIN_TOKEN: "admin-token" });
  try {
    const request = { headers: { authorization: "Bearer admin-token" } } as any;
    assert.equal(authorizeAutomationRequest(request), "authorized");
    assert.equal(authorizeAutomationRequest({ headers: { authorization: "Bearer wrong" } } as any), "unauthorized");
  } finally {
    restore();
  }
});

test("enforces request limits and safe validation errors", () => {
  const oversized = { headers: { "content-length": "70000" }, body: "{}" } as any;
  assert.throws(() => jsonBody(oversized), (error: unknown) => error instanceof RequestValidationError && error.statusCode === 413);
  assert.throws(() => validateSocialStatusPayload({ event: "wrong", job_id: "7", platform: "x", status: "published" }), /Invalid callback event/);
  assert.throws(() => validateSocialStatusPayload({ event: "content.distribution.updated", job_id: "7", platform: "mastodon", status: "published" }), /Unsupported platform/);
  assert.throws(() => validateSocialStatusPayload({ event: "content.distribution.updated", job_id: "7", platform: "x", status: "published", publish_url: "javascript:alert(1)" }), /HTTP or HTTPS/);
});

test("validates callback identity and keeps repeated delivery on one publication target", () => {
  const payload = { event: "content.distribution.updated", version: 1, job_id: "7", platform: "x", status: "published", idempotency_key: "newssa-distribution-7", external_id: "external-7", publish_url: "https://x.example/post/7" };
  const first = validateSocialStatusPayload(payload);
  const repeated = validateSocialStatusPayload({ ...payload });
  assert.deepEqual(repeated, first);
  assert.equal(`${first.jobId}:${first.platform}`, "7:x");
});

test("applies the route limiter without exposing internal details", () => {
  const suffix = String(Date.now());
  const response = { setHeader() {}, status(code: number) { this.code = code; return this; }, json(body: unknown) { this.body = body; return this; } } as any;
  const request = { headers: {}, socket: { remoteAddress: `test-${suffix}` } } as any;
  assert.equal(requireRateLimit(request, response, `test-${suffix}`, 1, 60_000), true);
  assert.equal(requireRateLimit(request, response, `test-${suffix}`, 1, 60_000), false);
  assert.equal(response.code, 429);
  assert.deepEqual(response.body, { error: "Too many requests. Please try again later." });
});

test("detects valid published WordPress posts and rejects invalid lists", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify([{ id: 42, status: "publish", title: { rendered: "Article" } }]), { status: 200 });
    const posts = await fetchPublishedWordPressPosts(20);
    assert.deepEqual(posts.map(post => post.id), [42]);
    assert.equal(isValidHttpUrl("https://newssa.co.za/article/42"), true);

    globalThis.fetch = async () => new Response(JSON.stringify({ invalid: true }), { status: 200 });
    await assert.rejects(() => fetchPublishedWordPressPosts(), /invalid post list/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("distinguishes already processed and duplicate detection inputs", () => {
  const posts = [{ id: 42 }, { id: 43 }, { id: 42 }];
  assert.equal(isKnownWordPressPost(42, new Set([42])), true);
  assert.equal(isKnownWordPressPost(43, new Set([42])), false);
  assert.deepEqual(findUnprocessedWordPressPostIds(posts, new Set([42])), [43]);
  assert.deepEqual(findUnprocessedWordPressPostIds(posts, new Set()), [42, 43]);
});

test("advances the checkpoint only after successful dispatch", () => {
  assert.equal(shouldAdvanceDetectorCheckpoint(true), true);
  assert.equal(shouldAdvanceDetectorCheckpoint(false), false);
});

test("reports WordPress transport failure without fabricating success", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("upstream failure", { status: 503 });
    await assert.rejects(() => fetchPublishedWordPressPosts(), /HTTP 503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("orders checkpoint candidates by publication timestamp and post id", () => {
  const posts = [
    { id: 9, date: "2026-09-15T10:00:00.000Z" },
    { id: 7, date: "2026-09-15T09:00:00.000Z" },
    { id: 8, date: "2026-09-15T10:00:00.000Z" },
  ];
  assert.deepEqual(sortPublishedPosts(posts).map(post => post.id), [7, 8, 9]);
  assert.equal(isAfterPublicationCursor(posts[2], { publishedAt: "2026-09-15T10:00:00.000Z", postId: 7 }), true);
  assert.equal(isAfterPublicationCursor(posts[0], { publishedAt: "2026-09-15T10:00:00.000Z", postId: 8 }), true);
});

test("queries all paginated posts after the checkpoint boundary", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  try {
    globalThis.fetch = async input => {
      requests.push(String(input));
      const page = new URL(String(input)).searchParams.get("page");
      const body = page === "1"
        ? [{ id: 11, date: "2026-09-15T10:00:00.000Z" }]
        : [{ id: 12, date: "2026-09-15T10:01:00.000Z" }];
      return new Response(JSON.stringify(body), { status: 200, headers: { "X-WP-TotalPages": "2" } });
    };
    const posts = await fetchPublishedWordPressPostsSince({ publishedAt: "2026-09-15T09:59:00.000Z", postId: 0 });
    assert.deepEqual(posts.map(post => post.id), [11, 12]);
    assert.equal(requests.length, 2);
    assert.equal(new URL(requests[0]).searchParams.get("order"), "asc");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preserves consolidated automation and SEO route contracts", () => {
  const request = (action: string | string[]) => ({ query: { action } }) as any;
  assert.equal(resolveAutomationAction(request("create-job")), "create-job");
  assert.equal(resolveAutomationAction(request("detect-posts")), "detect-posts");
  assert.equal(resolveAutomationAction(request("social-status")), "social-status");
  assert.equal(resolveAutomationAction(request("unknown")), null);
  assert.equal(resolveSeoRoute({ query: { route: "robots" } } as any), "robots");
  assert.equal(resolveSeoRoute({ query: { route: ["sitemap"] } } as any), "sitemap");
});
