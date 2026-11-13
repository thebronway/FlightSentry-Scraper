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

  const apiKeyColumns = database
    .prepare('PRAGMA table_info(api_keys)')
    .all() as Array<{ name: string }>;

  if (!apiKeyColumns.some((col) => col.name === 'totalRequests')) {
    database.exec(
      `ALTER TABLE api_keys ADD COLUMN totalRequests INTEGER NOT NULL DEFAULT 0;`
    );
    database.exec(
      `UPDATE api_keys
       SET totalRequests = (
         SELECT COUNT(*)
         FROM scrape_logs
         WHERE scrape_logs.apiKeyId = api_keys.id
           AND scrape_logs.status != 'RateLimited'
       );`
    );
  }

  const settingsColumns = database
    .prepare('PRAGMA table_info(settings)')
    .all() as Array<{ name: string }>;

  if (!settingsColumns.some((col) => col.name === 'globalPaused')) {
    database.exec(
      `ALTER TABLE settings ADD COLUMN globalPaused INTEGER NOT NULL DEFAULT 0;`
    );
  }

  if (!settingsColumns.some((col) => col.name === 'globalPausedAt')) {
    database.exec(
      `ALTER TABLE settings ADD COLUMN globalPausedAt TEXT;`
    );
  }

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
          globalPaused,
          globalPausedAt,
          proxyUrl,
          updatedAt
        ) VALUES (1, ?, ?, 4000, 9000, 2500, 20, 150, 60, NULL, NULL, 0, NULL, NULL, ?)`
      )
      .run(adminPasswordHash, sessionSecret, now);
  }
}