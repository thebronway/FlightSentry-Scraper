import { db } from './index';
import type { ApiKeyRecord, OverallApiKeyUsage } from '@/types';

export interface ActiveApiKeyRow {
  id: number;
  name: string;
  keyPrefix: string;
  keyHash: string;
}

interface ApiKeyListRow {
  id: number;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  totalRequests: number;
  last1h: number;
  last24h: number;
}

export function createApiKey(
  name: string,
  keyPrefix: string,
  keyHash: string
): ApiKeyRecord {
  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO api_keys (name, keyPrefix, keyHash, createdAt, lastUsedAt, revokedAt, totalRequests)
       VALUES (?, ?, ?, ?, NULL, NULL, 0)`
    )
    .run(name, keyPrefix, keyHash, createdAt);

  return {
    id: Number(result.lastInsertRowid),
    name,
    keyPrefix,
    createdAt,
    lastUsedAt: null,
    revokedAt: null,
    usage: {
      last1h: 0,
      last24h: 0,
      total: 0,
    },
  };
}

export function listApiKeys(): ApiKeyRecord[] {
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const rows = db
    .prepare(
      `SELECT
         k.id,
         k.name,
         k.keyPrefix,
         k.createdAt,
         k.lastUsedAt,
         k.revokedAt,
         k.totalRequests,
         COALESCE(
           SUM(CASE WHEN l.queriedAt >= ? AND l.status NOT IN ('RateLimited', 'Paused') THEN 1 ELSE 0 END),
           0
         ) AS last1h,
         COALESCE(
           SUM(CASE WHEN l.queriedAt >= ? AND l.status NOT IN ('RateLimited', 'Paused') THEN 1 ELSE 0 END),
           0
         ) AS last24h
       FROM api_keys k
       LEFT JOIN scrape_logs l ON l.apiKeyId = k.id
       GROUP BY k.id
       ORDER BY k.createdAt DESC, k.id DESC`
    )
    .all(oneHourAgo, twentyFourHoursAgo) as ApiKeyListRow[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    usage: {
      last1h: row.last1h,
      last24h: row.last24h,
      total: Math.max(row.totalRequests, row.last24h),
    },
  }));
}

export function getOverallApiKeyUsage(): OverallApiKeyUsage {
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const keySummary = db
    .prepare(
      `SELECT
         COALESCE(SUM(totalRequests), 0) AS total,
         COALESCE(SUM(CASE WHEN revokedAt IS NULL THEN 1 ELSE 0 END), 0) AS activeKeys,
         COALESCE(SUM(CASE WHEN revokedAt IS NOT NULL THEN 1 ELSE 0 END), 0) AS revokedKeys
       FROM api_keys`
    )
    .get() as { total: number; activeKeys: number; revokedKeys: number };

  const windowSummary = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN queriedAt >= ? THEN 1 ELSE 0 END), 0) AS last1h,
         COALESCE(SUM(CASE WHEN queriedAt >= ? THEN 1 ELSE 0 END), 0) AS last24h
       FROM scrape_logs
       WHERE apiKeyId IS NOT NULL AND status NOT IN ('RateLimited', 'Paused')`
    )
    .get(oneHourAgo, twentyFourHoursAgo) as { last1h: number; last24h: number };

  return {
    last1h: windowSummary.last1h,
    last24h: windowSummary.last24h,
    total: Math.max(keySummary.total, windowSummary.last24h),
    activeKeys: keySummary.activeKeys,
    revokedKeys: keySummary.revokedKeys,
  };
}

export function findActiveKeyByHash(keyHash: string): ActiveApiKeyRow | null {
  const row = db
    .prepare(
      `SELECT id, name, keyPrefix, keyHash
       FROM api_keys
       WHERE keyHash = ? AND revokedAt IS NULL`
    )
    .get(keyHash) as ActiveApiKeyRow | undefined;

  return row ?? null;
}

export function touchApiKeyLastUsed(id: number): void {
  const now = new Date().toISOString();
  db.prepare('UPDATE api_keys SET lastUsedAt = ? WHERE id = ?').run(now, id);
}

export function getApiKeyById(
  id: number
): { id: number; revokedAt: string | null } | null {
  const row = db
    .prepare('SELECT id, revokedAt FROM api_keys WHERE id = ?')
    .get(id) as { id: number; revokedAt: string | null } | undefined;

  return row ?? null;
}

export function revokeApiKey(id: number): boolean {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE api_keys
       SET revokedAt = ?
       WHERE id = ? AND revokedAt IS NULL`
    )
    .run(now, id);

  return result.changes === 1;
}

export function deleteRevokedApiKey(id: number): boolean {
  const result = db
    .prepare(
      `DELETE FROM api_keys
       WHERE id = ? AND revokedAt IS NOT NULL`
    )
    .run(id);

  return result.changes === 1;
}