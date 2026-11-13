export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    adminPasswordHash TEXT,
    sessionSecret TEXT NOT NULL,
    minJitterMs INTEGER NOT NULL DEFAULT 4000,
    maxJitterMs INTEGER NOT NULL DEFAULT 9000,
    settleDelayMs INTEGER NOT NULL DEFAULT 2500,
    maxRequestsPerHour INTEGER NOT NULL DEFAULT 20,
    maxRequestsPerDay INTEGER NOT NULL DEFAULT 150,
    cooldownMinutes INTEGER NOT NULL DEFAULT 60,
    circuitBreakerUntil TEXT,
    circuitBreakerReason TEXT,
    globalPaused INTEGER NOT NULL DEFAULT 0,
    globalPausedAt TEXT,
    proxyUrl TEXT,
    updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    keyPrefix TEXT NOT NULL,
    keyHash TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL,
    lastUsedAt TEXT,
    revokedAt TEXT,
    totalRequests INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scrape_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    apiKeyId INTEGER,
    route TEXT NOT NULL,
    flightNumber TEXT,
    departureDate TEXT NOT NULL,
    cabinClass TEXT NOT NULL,
    fareTier TEXT NOT NULL,
    status TEXT NOT NULL,
    statusCode INTEGER NOT NULL,
    itineraryCount INTEGER NOT NULL DEFAULT 0,
    lowestPrice REAL,
    currency TEXT,
    errorMessage TEXT,
    durationMs INTEGER NOT NULL,
    queriedAt TEXT NOT NULL,
    FOREIGN KEY (apiKeyId) REFERENCES api_keys(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scrape_logs_queried_at ON scrape_logs(queriedAt DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_api_key_queried_at ON scrape_logs(apiKeyId, queriedAt DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(keyHash);
`;