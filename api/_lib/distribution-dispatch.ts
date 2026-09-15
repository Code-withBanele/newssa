import { buildDispatchPayload, createWebhookSignature, getDispatchEnabled, getWebhookSecret, type DispatchPublication, type NormalizedArticle } from "./content-distribution.js";

export interface DispatchResult {
  success: boolean;
  dispatched: boolean;
  statusCode?: number;
  idempotencyKey: string;
  error?: string;
  retryable?: boolean;
}

interface DispatchConfig {
  fetcher?: typeof fetch;
  now?: () => Date;
}

function webhookUrl(): string | null {
  const value = String(process.env.CONTENT_DISTRIBUTION_WEBHOOK_URL ?? "").trim();
  return value || null;
}

function timeoutMilliseconds(): number {
  const configured = Number(process.env.CONTENT_DISTRIBUTION_WEBHOOK_TIMEOUT_MS ?? 10000);
  return Number.isFinite(configured) && configured > 0 ? configured : 10000;
}

export async function dispatchDistributionEvent(
  jobId: number,
  article: NormalizedArticle,
  publications: DispatchPublication[],
  config: DispatchConfig = {},
): Promise<DispatchResult> {
  const idempotencyKey = `newssa-distribution-${jobId}`;
  if (!getDispatchEnabled()) {
    return { success: true, dispatched: false, idempotencyKey };
  }

  const secret = getWebhookSecret();
  const url = webhookUrl();
  if (!secret || !url) {
    return {
      success: false,
      dispatched: false,
      idempotencyKey,
      error: "Content distribution dispatch is enabled but webhook configuration is incomplete.",
      retryable: false,
    };
  }

  const now = (config.now ?? (() => new Date()))();
  const createdAt = now.toISOString();
  const payload = buildDispatchPayload(jobId, article, publications, createdAt);
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const signature = createWebhookSignature(secret, timestamp, rawBody);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds());
  const fetcher = config.fetcher ?? fetch;

  console.info("Content distribution dispatch attempted", { jobId, idempotencyKey });
  try {
    const response = await fetcher(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NewsSA-Timestamp": timestamp,
        "X-NewsSA-Signature": signature,
      },
      body: rawBody,
      signal: controller.signal,
    });
    const result: DispatchResult = {
      success: response.ok,
      dispatched: true,
      statusCode: response.status,
      idempotencyKey,
      ...(response.ok ? {} : { error: `Webhook returned HTTP ${response.status}.`, retryable: response.status >= 500 }),
    };
    console.info(result.success ? "Content distribution dispatch succeeded" : "Content distribution dispatch failed", { jobId, idempotencyKey, statusCode: response.status });
    return result;
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    const result: DispatchResult = {
      success: false,
      dispatched: false,
      idempotencyKey,
      error: aborted ? "Content distribution webhook timed out." : "Content distribution webhook request failed.",
      retryable: true,
    };
    console.error("Content distribution dispatch failed", { jobId, idempotencyKey, error: result.error });
    return result;
  } finally {
    clearTimeout(timeout);
  }
}