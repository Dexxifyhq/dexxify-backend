import { randomBytes, createHash, createHmac } from 'crypto';

/**
 * Generate a Dexxify API key.
 * Format: dex_{env}_{32 random chars}
 */
export function generateApiKey(environment: 'sandbox' | 'live'): {
  key: string;
  prefix: string;
  hash: string;
} {
  const random = randomBytes(24).toString('base64url');
  const key = `dex_${environment === 'live' ? 'live' : 'test'}_${random}`;
  const prefix = key.substring(0, 12);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

/**
 * Hash an API key using SHA-256 for storage.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Generate HMAC-SHA256 signature for webhook payloads.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Parse pagination params with sensible defaults.
 */
export function parsePagination(query: { page?: number; limit?: number }): {
  offset: number;
  limit: number;
  page: number;
} {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { offset, limit, page };
}

/**
 * Build pagination metadata.
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
) {
  return {
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
    has_next: page * limit < total,
    has_prev: page > 1,
  };
}
