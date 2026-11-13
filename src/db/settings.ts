import { db } from './index';
import type { PublicScraperSettings, ScraperSettings } from '@/types';

export interface UpdateGuardrailsInput {
  minJitterMs: number;
  maxJitterMs: number;
  settleDelayMs: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  cooldownMinutes: number;
  proxyUrl?: string | null;
}

function maskProxyUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const authPart = parsed.username ? '****:****@' : '';
    const portPart = parsed.port ? `:${parsed.port}` : '';
    return `${parsed.protocol}//${authPart}${parsed.hostname}${portPart}`;
  } catch {
    return '****';
  }
}

export function getSettings(): ScraperSettings {
  const row = db
    .prepare('SELECT * FROM settings WHERE id = 1')
    .get() as ScraperSettings;

  if (row.circuitBreakerUntil) {
    const expiresAt = Date.parse(row.circuitBreakerUntil);
    if (!Number.isNaN(expiresAt) && Date.now() >= expiresAt) {
      resetCircuitBreaker();
      return {
        ...row,
        circuitBreakerUntil: null,
        circuitBreakerReason: null,
      };
    }
  }

  return row;
}

export function getPublicSettings(): PublicScraperSettings {
  const s = getSettings();
  const circuitBreakerActive = Boolean(
    s.circuitBreakerUntil && Date.parse(s.circuitBreakerUntil) > Date.now()
  );

  return {
    hasAdminPassword: Boolean(s.adminPasswordHash),
    minJitterMs: s.minJitterMs,
    maxJitterMs: s.maxJitterMs,
    settleDelayMs: s.settleDelayMs,
    maxRequestsPerHour: s.maxRequestsPerHour,
    maxRequestsPerDay: s.maxRequestsPerDay,
    cooldownMinutes: s.cooldownMinutes,
    circuitBreakerActive,
    circuitBreakerUntil: circuitBreakerActive ? s.circuitBreakerUntil : null,
    circuitBreakerReason: circuitBreakerActive ? s.circuitBreakerReason : null,
    hasProxy: Boolean(s.proxyUrl),
    maskedProxyUrl: maskProxyUrl(s.proxyUrl),
    updatedAt: s.updatedAt,
  };
}

export function setInitialAdminPassword(passwordHash: string): boolean {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE settings
       SET adminPasswordHash = ?, updatedAt = ?
       WHERE id = 1 AND adminPasswordHash IS NULL`
    )
    .run(passwordHash, now);

  return result.changes === 1;
}

export function updateAdminPassword(
  passwordHash: string,
  newSessionSecret: string
): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE settings
     SET adminPasswordHash = ?, sessionSecret = ?, updatedAt = ?
     WHERE id = 1`
  ).run(passwordHash, newSessionSecret, now);
}

export function updateGuardrails(input: UpdateGuardrailsInput): ScraperSettings {
  const current = getSettings();
  const nextProxy =
    input.proxyUrl === undefined
      ? current.proxyUrl
      : input.proxyUrl === ''
        ? null
        : input.proxyUrl;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE settings
     SET minJitterMs = ?,
         maxJitterMs = ?,
         settleDelayMs = ?,
         maxRequestsPerHour = ?,
         maxRequestsPerDay = ?,
         cooldownMinutes = ?,
         proxyUrl = ?,
         updatedAt = ?
     WHERE id = 1`
  ).run(
    input.minJitterMs,
    input.maxJitterMs,
    input.settleDelayMs,
    input.maxRequestsPerHour,
    input.maxRequestsPerDay,
    input.cooldownMinutes,
    nextProxy,
    now
  );

  return getSettings();
}

export function tripCircuitBreaker(reason: string): string {
  const current = getSettings();
  const until = new Date(
    Date.now() + current.cooldownMinutes * 60 * 1000
  ).toISOString();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE settings
     SET circuitBreakerUntil = ?, circuitBreakerReason = ?, updatedAt = ?
     WHERE id = 1`
  ).run(until, reason, now);

  return until;
}

export function resetCircuitBreaker(): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE settings
     SET circuitBreakerUntil = NULL, circuitBreakerReason = NULL, updatedAt = ?
     WHERE id = 1`
  ).run(now);
}