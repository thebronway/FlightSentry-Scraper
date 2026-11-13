import { db } from './index';
import type { ApiKeyRecord } from '@/types';

export interface ActiveApiKeyRow {
  id: number;
  name: string;
  keyPrefix: string;
  keyHash: string;
}

export function createApiKey(
  name: string,
  keyPrefix: string,
  keyHash: string
): ApiKeyRecord {
  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO api_keys (name, keyPrefix, keyHash, createdAt, lastUsedAt, revokedAt)
       VALUES (?, ?, ?, ?, NULL, NULL)`
    )
    .run(name, keyPrefix, keyHash, createdAt);

  return {
    id: Number(result.lastInsertRowid),
    name,
    keyPrefix,
    createdAt,
    lastUsedAt: null,
    revokedAt: null,
  };
}

export function listApiKeys(): ApiKeyRecord[] {
  return db
    .prepare(
      `SELECT id, name, keyPrefix, createdAt, lastUsedAt, revokedAt
       FROM api_keys
       ORDER BY createdAt DESC, id DESC`
    )
    .all() as ApiKeyRecord[];
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