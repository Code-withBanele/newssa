export interface AccountUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthChallenge {
  challenge: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error ?? "Request failed.");
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export function getCurrentUser() {
  return request<{ user: AccountUser }>("/api/auth/me");
}

export function login(email: string, password: string) {
  return request<AuthChallenge>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function register(firstName: string, lastName: string, email: string, password: string) {
  return request<AuthChallenge>("/api/auth/register", { method: "POST", body: JSON.stringify({ firstName, lastName, email, password }) });
}

export function verifyTwoFactor(challenge: string, token: string) {
  return request<{ user: AccountUser }>("/api/auth/verify-2fa", { method: "POST", body: JSON.stringify({ challenge, token }) });
}

export function resendVerification(challenge: string) {
  return request<AuthChallenge>("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ challenge }) });
}

export function requestPasswordReset(email: string) {
  return request<AuthChallenge & { message?: string }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export function resetPassword(challenge: string, token: string, password: string) {
  return request<void>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ challenge, token, password }) });
}

export function logout() {
  return request<void>("/api/auth/logout", { method: "POST" });
}

export function getSavedArticles() {
  return request<{ articles: { articleId: number; savedAt: string }[] }>("/api/saved-articles");
}

export function saveArticle(articleId: number) {
  return request<void>("/api/saved-articles", { method: "POST", body: JSON.stringify({ articleId }) });
}

export function unsaveArticle(articleId: number) {
  return request<void>("/api/saved-articles", { method: "DELETE", body: JSON.stringify({ articleId }) });
}

export function subscribeNewsletter(email: string) {
  return request<void>("/api/newsletter/subscribe", { method: "POST", body: JSON.stringify({ email }) });
}
