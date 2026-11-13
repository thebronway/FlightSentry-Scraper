import { db } from './index';
import type { ScrapeLogEntry } from '@/types';

const MAX_RETAINED_LOGS = 500;

export function insertScrapeLog(entry: Omit<ScrapeLogEntry, 'id'>): number {
  const result = db
    .prepare(
      `INSERT INTO scrape_logs (
        apiKeyId,
        route,
        flightNumber,
        departureDate,
        cabinClass,
        fareTier,
        status,
        statusCode,
        itineraryCount,
        lowestPrice,
        currency,
        errorMessage,
        durationMs,
        queriedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry.apiKeyId,
      entry.route,
      entry.flightNumber,
      entry.departureDate,
      entry.cabinClass,
      entry.fareTier,
      entry.status,
      entry.statusCode,
      entry.itineraryCount,
      entry.lowestPrice,
      entry.currency,
      entry.errorMessage,
      entry.durationMs,
      entry.queriedAt
    );

  if (entry.apiKeyId !== null && entry.status !== 'RateLimited') {
    db.prepare(
      `UPDATE api_keys
       SET totalRequests = totalRequests + 1
       WHERE id = ?`
    ).run(entry.apiKeyId);
  }

  // Keep SQLite compact by retaining the most recent 500 entries
  db.prepare(
    `DELETE FROM scrape_logs
     WHERE id NOT IN (
       SELECT id FROM scrape_logs ORDER BY queriedAt DESC, id DESC LIMIT ?
     )`
  ).run(MAX_RETAINED_LOGS);

  return Number(result.lastInsertRowid);
}

export function getRecentScrapeLogs(limit = 50): ScrapeLogEntry[] {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 200);
  return db
    .prepare(
      `SELECT *
       FROM scrape_logs
       ORDER BY queriedAt DESC, id DESC
       LIMIT ?`
    )
    .all(safeLimit) as ScrapeLogEntry[];
}

export function getRollingUsageCounts(): {
  hourlyUsed: number;
  dailyUsed: number;
} {
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const hourlyRow = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM scrape_logs
       WHERE queriedAt >= ? AND status != 'RateLimited'`
    )
    .get(oneHourAgo) as { count: number };

  const dailyRow = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM scrape_logs
       WHERE queriedAt >= ? AND status != 'RateLimited'`
    )
    .get(twentyFourHoursAgo) as { count: number };

  return {
    hourlyUsed: hourlyRow.count,
    dailyUsed: dailyRow.count,
  };
}