import type { VercelPoolClient } from "@vercel/postgres";

export const WORDPRESS_PUBLICATION_CHECKPOINT = "wordpress-publication-detector";

export interface PublicationCursor {
  publishedAt: string;
  postId: number;
}

export async function lockWordPressPublicationDetector(client: VercelPoolClient) {
  await client.sql`SELECT pg_advisory_xact_lock(hashtext(${WORDPRESS_PUBLICATION_CHECKPOINT}))`;
}

export async function readPublicationCheckpoint(client: VercelPoolClient): Promise<PublicationCursor | null> {
  const result = await client.sql<{ publishedAt: string; postId: number }>`
    SELECT checkpoint_at AS "publishedAt", checkpoint_post_id AS "postId"
    FROM automation_checkpoints
    WHERE checkpoint_key = ${WORDPRESS_PUBLICATION_CHECKPOINT}
  `;
  return result.rows[0] ?? null;
}

export async function writePublicationCheckpoint(client: VercelPoolClient, cursor: PublicationCursor) {
  await client.sql`
    INSERT INTO automation_checkpoints (checkpoint_key, checkpoint_at, checkpoint_post_id, updated_at)
    VALUES (${WORDPRESS_PUBLICATION_CHECKPOINT}, ${cursor.publishedAt}, ${cursor.postId}, NOW())
    ON CONFLICT (checkpoint_key)
    DO UPDATE SET
      checkpoint_at = EXCLUDED.checkpoint_at,
      checkpoint_post_id = EXCLUDED.checkpoint_post_id,
      updated_at = NOW()
  `;
}