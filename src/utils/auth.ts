import crypto from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { getSettings } from '@/db/settings';

export const ADMIN_COOKIE_NAME = 'fss_admin_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;

interface LoginAttemptRecord {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, LoginAttemptRecord>();

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex || keyHex.length !== 128) return false;

  const expectedBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);

  if (expectedBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, derivedBuffer);
}

export function createSessionToken(sessionSecret: string): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${expiresAt}.${nonce}`;
  const signature = crypto
    .createHmac('sha256', sessionSecret)
    .update(payload)
    .digest('hex');

  return `${payload}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined,
  sessionSecret: string
): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [expiresAtStr, nonce, signature] = parts;
  if (!expiresAtStr || !nonce || !signature) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
    return false;
  }

  const payload = `${expiresAtStr}.${nonce}`;
  const expectedSig = crypto
    .createHmac('sha256', sessionSecret)
    .update(payload)
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSig, 'utf8');
  if (sigBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

export function isAdminAuthenticated(req: NextRequest): boolean {
  const settings = getSettings();
  if (!settings.adminPasswordHash) return false;
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifySessionToken(token, settings.sessionSecret);
}

export function attachSessionCookie(
  res: NextResponse,
  req: NextRequest,
  sessionSecret: string
): void {
  const token = createSessionToken(sessionSecret);
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const isSecure =
    process.env.COOKIE_SECURE === 'true' || forwardedProto === 'https';

  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}

export function checkLoginRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { allowed: true, retryAfterSeconds: 0 };

  if (now >= entry.resetAt) {
    loginAttempts.delete(ip);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(ip, {
      count: 1,
      resetAt: now + LOGIN_WINDOW_MS,
    });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(ip: string): void {
  loginAttempts.delete(ip);
}