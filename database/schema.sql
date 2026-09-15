CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret_encrypted TEXT,
  verification_code_hash TEXT,
  verification_code_expires_at TIMESTAMPTZ,
  verification_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_attempts INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS saved_articles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id BIGINT NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, article_id)
);
CREATE INDEX IF NOT EXISTS saved_articles_user_id_idx ON saved_articles(user_id, saved_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_active_email_idx
  ON newsletter_subscribers(email) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS newsletter_user_id_idx ON newsletter_subscribers(user_id);

CREATE TABLE IF NOT EXISTS content_distribution_jobs (
  id BIGSERIAL PRIMARY KEY,
  wordpress_post_id BIGINT NOT NULL,
  source TEXT NOT NULL DEFAULT 'wordpress' CHECK (source IN ('wordpress')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  article_url TEXT NOT NULL,
  featured_image_url TEXT,
  category TEXT,
  platform_list TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'partial', 'failed')),
  dispatch_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wordpress_post_id, source)
);
CREATE INDEX IF NOT EXISTS content_distribution_jobs_status_idx ON content_distribution_jobs(status);

CREATE TABLE IF NOT EXISTS content_distribution_publications (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES content_distribution_jobs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'linkedin', 'x')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'scheduled', 'published', 'failed', 'skipped')),
  external_id TEXT,
  publish_url TEXT,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, platform)
);
CREATE INDEX IF NOT EXISTS content_distribution_publications_job_idx ON content_distribution_publications(job_id);

CREATE TABLE IF NOT EXISTS automation_checkpoints (
  checkpoint_key TEXT PRIMARY KEY,
  checkpoint_at TIMESTAMPTZ NOT NULL,
  checkpoint_post_id BIGINT NOT NULL DEFAULT 0 CHECK (checkpoint_post_id >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
