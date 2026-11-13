import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { SCHEMA_SQL } from './schema';

function hashBootstrapPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function initializeDatabase(database: Database.Database): void {
  database.exec(SCHEMA_SQL);

  const existing = database
    .prepare('SELECT id FROM settings WHERE id = 1')
    .get() as { id: number } | undefined;

  if (!existing) {
    const sessionSecret = crypto.randomBytes(32).toString('hex');
    const envPassword = process.env.ADMIN_PASSWORD?.trim();
    const adminPasswordHash =
      envPassword && envPassword.length >= 8
        ? hashBootstrapPassword(envPassword)
        : null;

    const now = new Date().toISOString();

    database
      .prepare(
        `INSERT INTO settings (
          id,
          adminPasswordHash,
          sessionSecret,
          minJitterMs,
          maxJitterMs,
          settleDelayMs,
          maxRequestsPerHour,
          maxRequestsPerDay,
          cooldownMinutes,
          circuitBreakerUntil,
          circuitBreakerReason,
          proxyUrl,
          updatedAt
        ) VALUES (1, ?, ?, 4000, 9000, 2500, 20, 150, 60, NULL, NULL, NULL, ?)`
      )
      .run(adminPasswordHash, sessionSecret, now);
  }
}