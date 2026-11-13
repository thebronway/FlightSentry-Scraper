import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { findActiveKeyByHash, touchApiKeyLastUsed } from '@/db/apiKeys';

const KEY_PREFIX = 'fss_';
const KEY_PATTERN = /^fss_[a-f0-9]{64}$/;

export interface GeneratedApiKey {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
}

export interface ApiKeyAuthResult {
  authenticated: boolean;
  keyId: number | null;
  keyName: string | null;
}

export function generateApiKey(): GeneratedApiKey {
  const randomHex = crypto.randomBytes(32).toString('hex');
  const rawKey = `${KEY_PREFIX}${randomHex}`;
  const keyPrefix = rawKey.slice(0, 12);
  const keyHash = hashApiKey(rawKey);

  return { rawKey, keyPrefix, keyHash };
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const xApiKey = req.headers.get('x-api-key');
  if (xApiKey) {
    return xApiKey.trim();
  }

  return null;
}

export function authenticateApiKey(req: NextRequest): ApiKeyAuthResult {
  const token = extractToken(req);
  if (!token || !KEY_PATTERN.test(token)) {
    return { authenticated: false, keyId: null, keyName: null };
  }

  const incomingHash = hashApiKey(token);
  const record = findActiveKeyByHash(incomingHash);
  if (!record) {
    return { authenticated: false, keyId: null, keyName: null };
  }

  const incomingBuffer = Buffer.from(incomingHash, 'hex');
  const storedBuffer = Buffer.from(record.keyHash, 'hex');
  if (
    incomingBuffer.length !== storedBuffer.length ||
    !crypto.timingSafeEqual(incomingBuffer, storedBuffer)
  ) {
    return { authenticated: false, keyId: null, keyName: null };
  }

  touchApiKeyLastUsed(record.id);
  return {
    authenticated: true,
    keyId: record.id,
    keyName: record.name,
  };
}