import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { initializeDatabase } from './init';

let instance: Database.Database | null = null;
let initialized = false;

function resolveDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  if (process.env.NODE_ENV === 'production' || fs.existsSync('/app/data')) {
    return '/app/data/scraper.db';
  }
  return path.join(process.cwd(), 'data', 'scraper.db');
}

function getConnection(): Database.Database {
  if (!instance) {
    const dbPath = resolveDatabasePath();
    const parentDir = path.dirname(dbPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const connection = new Database(dbPath);
    connection.pragma('journal_mode = WAL');
    connection.pragma('busy_timeout = 10000');
    connection.pragma('foreign_keys = ON');
    instance = connection;
  }

  if (!initialized) {
    initializeDatabase(instance);
    initialized = true;
  }

  return instance;
}

export const db = new Proxy({} as Database.Database, {
  get(_target, prop: keyof Database.Database) {
    const connection = getConnection();
    const value = connection[prop];
    return typeof value === 'function' ? value.bind(connection) : value;
  },
});