# FlightSentry-Scraper — Architectural & Implementation Specification

> **Important Note on Code Examples:** Every code snippet, directory layout, SQL schema, Dockerfile, and configuration block in this document is an **illustrative reference example** showing one clean way to satisfy the architecture, security invariants, and API contracts. They are **not** rigid templates that you must follow line-for-line. Use your engineering judgment to write idiomatic, modular, production-grade code as long as all behavioral, security, visual, and API contract requirements are met.

---

## 1. Project Overview & Engineering Standards
- **Repository:** {C}thebronway/FlightSentry-Scraper{C}
- **Docker Hub Image:** {C}thebronway/flightsentry-scraper{C}
- **Role:** Optional, self-hosted headless Chromium / Playwright microservice that scrapes Google Flights and exposes a rate-limited, API-key-authenticated REST API consumed by the main **FlightSentry** application ({C}thebronway/FlightSentry{C}).
- **Core Engineering Standards:**
  1. **Domain-Driven Modularity:** Keep files small, focused, and limited to a single responsibility. Organize folders cleanly for this microservice's domain without adding unused or artificial boilerplate directories.
  2. **Defense-in-Depth Security:** Validate all external inputs with {C}zod{C}, hash all passwords and API keys at rest, verify secrets using constant-time comparison ({C}crypto.timingSafeEqual{C}), lock Playwright network requests strictly to Google Flights domains, and run the application process as a non-root user.
  3. **Docker-Only Execution:** All builds, dependency installs, and runtime checks must execute inside Docker ({C}docker compose up --build{C}). Never rely on host Node or Playwright installations.
  4. **Methodical Phased Delivery:** Implement and validate one phase at a time with explicit Docker verification steps before moving to the next phase.

---

## 2. Technology Stack & Container Topology
- **Framework & Runtime:** Next.js 14 ({C}output: 'standalone'{C}), React 18, TypeScript 5 ({C}strict: true{C}), Node.js 20.
- **Database:** {C}better-sqlite3{C} ({C}WAL{C} journal mode, {C}busy_timeout = 10000{C}, {C}foreign_keys = ON{C}) wrapped in a lazy initialization pattern (such as a {C}Proxy{C}) so Next.js build workers never lock the SQLite file during {C}next build{C}.
  - **Production DB Path:** {C}/app/data/scraper.db{C}
  - **Development DB Path:** {C}./data/scraper.db{C}
- **Browser Automation:** {C}playwright{C} (Chromium) running inside a single container alongside the Next.js standalone server ({C}HOSTNAME=0.0.0.0{C}, default port {C}4001{C}, respecting the {C}PORT{C} environment variable).
- **Native Package Externalization ({C}next.config.js{C} example):**
{F}js
/** @type {{import('next').NextConfig}} */
const nextConfig = {{
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  experimental: {{
    serverComponentsExternalPackages: ['better-sqlite3', 'playwright'],
  }},
}};
module.exports = nextConfig;
{F}
- **Docker Base Image:** {C}node:20-bookworm-slim{C} (Debian) with {C}npx playwright install --with-deps chromium{C} executed during the image build so the exact Playwright-matched Chromium binary, {C}glibc{C}, shared libraries, and system fonts are included.
- **Shared Memory & Permissions:**
  - {C}docker-compose.yml{C} should configure {C}shm_size: '1gb'{C} alongside Chromium's {C}--disable-dev-shm-usage{C} launch flag to prevent {C}/dev/shm{C} crashes.
  - An entrypoint script should ensure {C}/app/data{C} and {C}/app/data/chrome-profile{C} exist and are writable by the non-root {C}node{C} user before starting the server.

---

## 3. Suggested Domain-Driven Structure (Example Layout)
Organize the codebase into small, single-responsibility modules (you may refine file names as appropriate):

{F}text
FlightSentry-Scraper/
├── Dockerfile
├── docker-compose.yml
├── entrypoint.sh
├── .dockerignore
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── public/
│   ├── logo-filled-sm.webp        # FlightSentry logo asset
│   └── favicon/                   # FlightSentry favicon assets
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx               # Auth gate -> First-Run Setup / Login / Admin Dashboard
    │   └── api/
    │       ├── admin/
    │       │   ├── auth/route.ts            # Initial password setup, login, logout, session check
    │       │   ├── keys/route.ts            # List & mint API keys
    │       │   ├── keys/[id]/route.ts       # Revoke/delete API key
    │       │   ├── settings/route.ts        # Read/update guardrails, proxy, and admin password
    │       │   ├── circuit-breaker/route.ts # Manual cooldown reset
    │       │   ├── test-scrape/route.ts     # Admin-authenticated live test scrape
    │       │   └── logs/route.ts            # Fetch recent scrape logs
    │       └── v1/
    │           ├── health/route.ts          # Authenticated health, queue & quota telemetry
    │           └── scrape/route.ts          # Authenticated flight scrape endpoint
    ├── components/
    │   ├── Navbar.tsx
    │   ├── Footer.tsx
    │   ├── AuthGateScreen.tsx               # Mandatory first-run password setup & login screen
    │   ├── EngineStatusCard.tsx             # Chromium status, cooldown timer & Reset button
    │   ├── ApiKeysCard.tsx                  # Mint key (one-time reveal), list & revoke
    │   ├── GuardrailsSettingsCard.tsx       # Jitter, hourly/daily caps, cooldown & proxy config
    │   ├── LiveTestScrapeCard.tsx           # Interactive route/flight test runner
    │   └── ScrapeLogsCard.tsx               # Scrollable diagnostic log viewer
    ├── db/
    │   ├── index.ts               # Lazy SQLite connection (WAL + busy_timeout)
    │   ├── schema.ts              # DDL for settings, api_keys, scrape_logs
    │   ├── init.ts                # Idempotent table creation & singleton settings seed
    │   ├── settings.ts            # Settings CRUD & circuit-breaker state helpers
    │   ├── apiKeys.ts             # SHA-256 key creation, lookup, lastUsedAt & revocation
    │   └── logs.ts                # Insert, query, and prune scrape logs
    ├── scraper/
    │   ├── browserManager.ts      # Singleton persistent Chromium lifecycle & cache pruning
    │   ├── queueManager.ts        # Strict serial FIFO queue (concurrency = 1) + jitter
    │   ├── rateLimiter.ts         # Rolling hourly/daily cap enforcement + circuit breaker
    │   ├── urlBuilder.ts          # Construct Google Flights URLs + IATA/Metro expansion
    │   ├── flightParser.ts        # Intercepted RPC / ds:1 payload parser + DOM fallback
    │   └── googleFlightsScraper.ts # Orchestrates navigation, consent handling, capture & cleanup
    ├── types/
    │   └── index.ts               # ScrapeRequest, ScrapeResponse, RouteItinerary, Settings, ApiKey
    └── utils/
        ├── auth.ts                # scryptSync password hashing, HMAC session cookie, login rate limit
        ├── apiKeyAuth.ts          # Bearer token SHA-256 + crypto.timingSafeEqual verification
        ├── airline.ts             # IATA 2-char carrier code normalization & flight number cleaner
        ├── coLocations.ts         # Metropolitan Area Code (WAS, NYC, LON, etc.) -> airport list
        └── validation.ts          # Zod schemas for /api/v1/* and /api/admin/*
{F}

---

## 4. Database Schema (Example SQLite DDL for {C}/app/data/scraper.db{C})

{F}sql
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    adminPasswordHash TEXT,                 -- NULL until first-run password setup completes
    sessionSecret TEXT NOT NULL,            -- Auto-generated 32-byte hex secret on first boot
    minJitterMs INTEGER NOT NULL DEFAULT 4000,
    maxJitterMs INTEGER NOT NULL DEFAULT 9000,
    settleDelayMs INTEGER NOT NULL DEFAULT 2500,
    maxRequestsPerHour INTEGER NOT NULL DEFAULT 20,
    maxRequestsPerDay INTEGER NOT NULL DEFAULT 150,
    cooldownMinutes INTEGER NOT NULL DEFAULT 60,
    circuitBreakerUntil TEXT,               -- ISO 8601 timestamp when active, else NULL
    circuitBreakerReason TEXT,
    proxyUrl TEXT,                          -- Optional http(s):// or socks5:// proxy URL
    updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    keyPrefix TEXT NOT NULL,                -- e.g. "fss_9a4f1c2e" for UI display
    keyHash TEXT NOT NULL UNIQUE,           -- SHA-256 hex digest of full raw key
    createdAt TEXT NOT NULL,
    lastUsedAt TEXT,
    revokedAt TEXT                          -- Soft-revoke timestamp (NULL = active)
);

CREATE TABLE IF NOT EXISTS scrape_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    apiKeyId INTEGER,                       -- NULL if triggered via Admin Live Test UI
    route TEXT NOT NULL,                    -- e.g. "DCA -> SFO"
    flightNumber TEXT,
    departureDate TEXT NOT NULL,
    cabinClass TEXT NOT NULL,
    fareTier TEXT NOT NULL,
    status TEXT NOT NULL,                   -- 'Success' | 'SoldOut' | 'RateLimited' | 'Error'
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
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(keyHash);
{F}

---

## 5. Authentication, Security & API Key Lifecycle

### A. Mandatory First-Run Admin Password
1. On initial boot, generate a cryptographically random 32-byte {C}sessionSecret{C} when seeding {C}settings{C}. If {C}process.env.ADMIN_PASSWORD{C} is provided on first boot and {C}adminPasswordHash{C} is {C}NULL{C}, hash and persist it automatically.
2. Whenever {C}adminPasswordHash{C} is {C}NULL{C}, {C}GET /{C} must render a Gunmetal **Initial Setup — Set Admin Password** screen requiring a strong password ({C}min 8 chars{C}) and confirmation before any dashboard controls or API key endpoints are usable.
3. Hash passwords using Node's built-in {C}crypto.scryptSync(password, salt, 64){C} (stored as {C}<saltHex>:<derivedKeyHex>{C}) and verify with {C}crypto.timingSafeEqual{C}.
4. Successful setup or login issues an {C}HttpOnly{C}, {C}SameSite=Lax{C}, {C}Path=/{C} cookie signed with HMAC-SHA256 using {C}settings.sessionSecret{C}.
5. Rate-limit login attempts on {C}POST /api/admin/auth{C} (e.g., max 5 failed attempts per 15 minutes per IP, returning {C}429 Too Many Requests{C}).
6. Every {C}/api/admin/*{C} route (aside from session status check and initial setup/login) must validate the admin session cookie and return {C}401 Unauthorized{C} when missing or invalid.

### B. External API Keys ({C}/api/v1/*{C})
- **Format Example:** {C}fss_{C} + {C}crypto.randomBytes(32).toString('hex'){C} (68 characters total).
- **Storage:** Store only a display prefix ({C}fss_9a4f1c2e{C}) and the SHA-256 hex digest ({C}keyHash{C}). Return the raw key **once** upon creation.
- **Verification:** Accept {C}Authorization: Bearer <token>{C} (or {C}X-API-Key{C}), hash the incoming token with SHA-256, look up the active ({C}revokedAt IS NULL{C}) key record, compare with {C}crypto.timingSafeEqual{C}, and update {C}lastUsedAt{C}.

### C. SSRF & Network Isolation
- Never accept arbitrary URLs from API callers. Construct {C}https://www.google.com/travel/flights{C} URLs internally from validated IATA/metro codes and dates.
- Attach a {C}page.route(){C} interceptor on every Playwright page:
  - **Allow** only {C}https:{C} requests targeting {C}www.google.com{C}, {C}google.com{C}, {C}consent.google.com{C}, and required {C}*.gstatic.com{C} / {C}*.googleapis.com{C} assets.
  - **Abort** {C}image{C}, {C}media{C}, and {C}font{C} resource types (plus third-party analytics/tracking domains) to reduce bandwidth, RAM usage, and page load latency.
  - **Block** any non-Google hostname immediately.

---

## 6. Playwright Anti-Bot, Serial Queue & Circuit Breaker Engine

1. **Strict Serial Queue:**
   - Enforce {C}concurrency = 1{C} via an in-process FIFO queue so Chromium never opens parallel Google Flights tabs.
   - Between consecutive scrapes, apply a randomized jitter delay between {C}minJitterMs{C} and {C}maxJitterMs{C} (default {C}4000ms - 9000ms{C}).
2. **Stealth Chromium + Persistent Profile ({C}/app/data/chrome-profile{C}):**
   - Launch a persistent context via {C}chromium.launchPersistentContext('/app/data/chrome-profile', {{ ... }}){C} with:
     - {C}headless: true{C}
     - {C}viewport: {{ width: 1366, height: 768 }}{C}
     - {C}locale: 'en-US'{C}
     - {C}timezoneId: process.env.TZ || 'America/New_York'{C}
     - {C}proxy: settings.proxyUrl ? {{ server: settings.proxyUrl }} : undefined{C}
     - Flags such as {C}['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']{C}
   - Mask {C}navigator.webdriver{C} via {C}context.addInitScript(...){C}.
   - Seed Google consent cookies ({C}SOCS{C}, {C}CONSENT{C}) and gracefully dismiss any consent interstitial if {C}consent.google.com{C} still renders.
   - **Self-Healing & Disk Hygiene:** Listen for browser/context disconnect events so the singleton relaunches cleanly on the next request. Periodically prune HTTP disk cache folders ({C}Default/Cache{C}, {C}Default/Code Cache{C}) inside {C}/app/data/chrome-profile{C} when size grows large while keeping {C}Cookies{C} and {C}Local Storage{C} intact.
3. **Self-Imposed Rolling Rate Caps & Circuit Breaker:**
   - Check {C}scrape_logs{C} counts over the trailing {C}1 hour{C} and {C}24 hours{C}. If {C}>= maxRequestsPerHour{C} (default {C}20{C}) or {C}>= maxRequestsPerDay{C} (default {C}150{C}), return {C}status: 'RateLimited'{C} ({C}HTTP 429{C}) immediately without opening a browser page.
   - **CAPTCHA / Block Detection:** Trip the circuit breaker ({C}circuitBreakerUntil = now + cooldownMinutes{C}, default {C}60m{C}) if:
     - Upstream returns HTTP {C}429{C} or {C}403{C},
     - Final URL lands on {C}/sorry/index{C} or remains stuck on {C}consent.google.com{C},
     - Page HTML contains {C}"unusual traffic"{C}, or
     - Google serves a CAPTCHA challenge ({C}iframe[src*="recaptcha"]{C}) with no flight payload.
   - While {C}now < circuitBreakerUntil{C}, immediately reject {C}POST /api/v1/scrape{C} with {C}HTTP 429{C} ({C}status: 'RateLimited'{C} and {C}meta.retryAfter = circuitBreakerUntil{C}) so the main FlightSentry app fails over to its metered APIs.

---

## 7. Google Flights Extraction & REST API Contract

### A. URL Construction & Dual-Layer Extraction
- Support single 3-letter IATA codes ({C}DCA{C}), Metropolitan Area Codes ({C}WAS -> DCA,IAD,BWI{C}, {C}NYC -> JFK,LGA,EWR,SWF,HPN{C}, {C}CHI -> ORD,MDW{C}, {C}LON -> LHR,LGW,STN,LTN,LCY,SEN{C}, {C}PAR -> CDG,ORY,BVA{C}, {C}TYO -> HND,NRT{C}, etc.), and comma-separated airport lists ({C}DCA,IAD{C}).
- Construct one-way Google Flights URLs with {C}hl=en{C}, {C}curr=<currency>{C}, cabin class ({C}economy{C}, {C}premium_economy{C}, {C}business{C}, {C}first{C}), stops filter ({C}0{C}, {C}1{C}, {C}2{C}), and carry-on / Standard fare filtering when {C}fareTier === 'Standard'{C} and {C}cabinClass === 'economy'{C}.
- **Extraction Strategy:**
  1. **Primary (Network RPC / {C}ds:1{C} Script Hydration):** Capture Google Flights' shopping XHR response or parse the hydrated {C}<script class="ds:1">{C} {C}AF_initDataCallback{C} payload after {C}networkidle{C} + {C}settleDelayMs{C} ({C}2500ms{C}), normalizing carrier codes to 2-char IATA codes and extracting full multi-leg details.
  2. **Fallback (Semantic DOM Extraction):** If Google changes its {C}ds:1{C} array indices, fall back to parsing rendered flight result cards from the DOM.
- Enforce a hard **30-second timeout** per scrape and always close the {C}Page{C} in a {C}finally{C} block.

### B. REST Endpoints ({C}/api/v1/*{C}) — Contract Specification

#### 1. {C}GET /api/v1/health{C}
Requires {C}Authorization: Bearer <key>{C}. Example {C}200 OK{C} response:
{F}json
{{
  "status": "ok",
  "version": "0.1.0",
  "circuitBreakerActive": false,
  "retryAfter": null,
  "queueDepth": 0,
  "usage": {{
    "hourlyUsed": 4,
    "hourlyLimit": 20,
    "dailyUsed": 28,
    "dailyLimit": 150
  }}
}}
{F}
*(When {C}circuitBreakerActive{C} is {C}true{C}, {C}status{C} should be {C}"cooldown"{C} and {C}retryAfter{C} an ISO 8601 timestamp.)*

#### 2. {C}POST /api/v1/scrape{C}
Requires {C}Authorization: Bearer <key>{C}. Note that the main FlightSentry app will always send explicit values for route, date, cabin, fare tier, and currency; optional defaults on the schema simply keep manual testing ergonomic.

**Example Request Body:**
{F}json
{{
  "origin": "WAS",
  "destination": "SFO",
  "departureDate": "2026-12-15",
  "cabinClass": "economy",
  "fareTier": "Standard",
  "currency": "USD",
  "maxStops": 1,
  "includedAirlines": ["UA", "AA"],
  "excludedAirlines": [],
  "airline": "UA",
  "flightNumber": "1492",
  "includeRaw": false
}}
{F}

**Response Contract (Matches FlightSentry's {C}DataSourceResult{C} & {C}RouteItinerary[]{C}):**
- HTTP Status Codes: {C}200{C} ({C}Success{C} or {C}SoldOut{C}), {C}429{C} ({C}RateLimited{C}), {C}400{C} (Zod validation failure), {C}401{C} (unauthorized), {C}502{C}/{C}504{C} (upstream/browser failure).
{F}json
{{
  "status": "Success",
  "price": 318,
  "currency": "USD",
  "leadingAirline": "UA",
  "leadingFlightNumber": "1492",
  "itineraries": [
    {{
      "airline": "UA",
      "airlineName": "United Airlines",
      "flightNumber": "1492",
      "origin": "IAD",
      "destination": "SFO",
      "price": 318,
      "departureTime": "2026-12-15 08:30",
      "arrivalTime": "2026-12-15 11:42",
      "duration": "6h 12m",
      "durationMinutes": 372,
      "stops": 0,
      "isNonstop": true,
      "layoverAirports": []
    }}
  ],
  "errorMessage": null,
  "meta": {{
    "durationMs": 5420,
    "retryAfter": null,
    "rawPayload": null
  }}
}}
{F}
*(When {C}includeRaw: true{C} is sent by FlightSentry's {C}/api-test{C} inspector, populate {C}meta.rawPayload{C} with the truncated upstream payload, capped at ~50 KB.)*

---

## 8. Admin Mini-UI & Gunmetal Visual Specification
Match **FlightSentry**'s exact dark visual identity:
- **Theme:** Forced dark mode ({C}<html lang="en" class="dark">{C}, {C}next-themes{C} {C}forcedTheme="dark"{C}).
- **Tailwind Palette ({C}tailwind.config.js{C} example):**
{F}js
colors: {{
  indigo: colors.slate,
  gunmetal: {{
    nav: '#0f0f11',
    canvas: '#1c1c1e',
    card: '#0f0f11',
    border: '#2d2d31',
    muted: '#9aa0a6',
  }},
}},
fontFamily: {{
  sans: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
}}
{F}
- **UI Components:**
  - {C}Navbar{C}: {C}bg-gunmetal-nav border-b border-gunmetal-border h-16{C}, FlightSentry logo ({C}/logo-filled-sm.webp{C}), title **{C}FlightSentry Scraper{C}**, live status pill ({C}Ready{C} / {C}Cooldown{C}), and **Sign Out** button.
  - **5 Modular Dashboard Cards** ({C}bg-gunmetal-card border border-gunmetal-border rounded-xl p-5{C}):
    1. **Engine Status & Circuit Breaker:** Chromium state, queue depth, hourly/daily quota progress bars, and an amber alert banner + **Reset Cooldown** button when the circuit breaker is active.
    2. **API Keys:** Create named key -> one-time copyable key display -> list of active/revoked keys ({C}Name{C}, {C}Prefix{C}, {C}Created{C}, {C}Last Used{C}, {C}Revoke{C}).
    3. **Scraper Guardrails & Proxy:** Configure {C}minJitterMs{C}, {C}maxJitterMs{C}, {C}settleDelayMs{C}, {C}maxRequestsPerHour{C}, {C}maxRequestsPerDay{C}, {C}cooldownMinutes{C}, optional {C}proxyUrl{C} (masked once saved), and Change Admin Password.
    4. **Live Test Scrape:** Form ({C}Origin{C}, {C}Destination{C}, {C}Departure Date{C}, {C}Cabin Class{C}, {C}Fare Tier{C}, {C}Currency{C}) to run an immediate test scrape and inspect returned itineraries.
    5. **Recent Scrape Logs:** Scrollable diagnostic log list with color-coded status badges ({C}Success{C} green, {C}RateLimited{C} amber, {C}SoldOut{C} slate, {C}Error{C} red), duration ({C}ms{C}), and error details.
  - {C}Footer{C}: {C}bg-gunmetal-nav border-t border-gunmetal-border{C} matching FlightSentry's footer styling.

---

## 9. Deployment Configuration (Example Files)

### Example {C}Dockerfile{C}
{F}dockerfile
FROM node:20-bookworm-slim

ENV NODE_ENV=production \\
    NEXT_TELEMETRY_DISABLED=1 \\
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update && apt-get install -y --no-install-recommends \\
    tzdata ca-certificates python3 make g++ libsqlite3-dev \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

RUN npx playwright install --with-deps chromium \\
    && chmod -R o+rx /ms-playwright

COPY . .
RUN npm run build \\
    && cp -r public .next/standalone/public \\
    && cp -r .next/static .next/standalone/.next/static \\
    && chmod +x /app/entrypoint.sh \\
    && mkdir -p /app/data \\
    && chown -R node:node /app

EXPOSE 4001

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", ".next/standalone/server.js"]
{F}

### Example {C}entrypoint.sh{C}
{F}sh
#!/bin/sh
set -e

mkdir -p /app/data /app/data/chrome-profile
chown -R node:node /app/data 2>/dev/null || true

export HOSTNAME=0.0.0.0
export PORT="${{PORT:-4001}}"

exec su -s /bin/sh node -c "$*"
{F}

### Example {C}docker-compose.yml{C}
{F}yaml
services:
  flightsentry-scraper:
    build:
      context: .
      dockerfile: Dockerfile
    image: thebronway/flightsentry-scraper:latest
    container_name: flightsentry_scraper
    ports:
      - "4001:4001"
    volumes:
      - ./data:/app/data
    shm_size: "1gb"
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - TZ=America/New_York
      - PORT=4001
      # Optional: pre-seed initial admin password on first boot
      # - ADMIN_PASSWORD=change-me-strong-password
{F}

---

## 10. Phased Implementation & Validation Plan

1. **Phase 1 — Project Scaffold, Gunmetal Theme & SQLite Layer:**
   - Set up Next.js 14 standalone app, Tailwind Gunmetal palette, SQLite database layer ({C}settings{C}, {C}api_keys{C}, {C}scrape_logs{C}), {C}Dockerfile{C}, {C}entrypoint.sh{C}, and {C}docker-compose.yml{C}.
   - *Validation:* Run {C}docker compose up --build -d{C} and confirm the container starts cleanly as non-root {C}node{C} and initializes {C}/app/data/scraper.db{C}.
2. **Phase 2 — Mandatory First-Run Auth, API Key Management & Mini-UI:**
   - Implement password setup/login ({C}scryptSync{C} + signed {C}HttpOnly{C} cookie), SHA-256 API key creation/revocation, {C}/api/admin/*{C} routes, and the 5 Gunmetal dashboard cards.
   - *Validation:* Rebuild container, open {C}http://localhost:4001{C}, complete first-run password setup, sign out/in, mint an {C}fss_...{C} API key, and verify the raw key is displayed once and stored hashed in SQLite.
3. **Phase 3 — Playwright Engine, Serial Queue, Rate Limiter & Extraction:**
   - Implement persistent stealth Chromium management, serial FIFO queue with jitter, rolling hourly/daily rate caps, CAPTCHA circuit breaker, URL builder, and Google Flights RPC/{C}ds:1{C} + DOM parser.
   - *Validation:* Trigger a live test scrape from the Mini-UI ({C}WAS -> SFO{C}) and confirm itineraries normalize into {C}RouteItinerary[]{C} with 2-char IATA codes and log to {C}scrape_logs{C}.
4. **Phase 4 — Public {C}/api/v1/health{C} & {C}/api/v1/scrape{C} Endpoints & End-to-End Verification:**
   - Wire {C}/api/v1/health{C} and {C}/api/v1/scrape{C} with Zod validation, Bearer auth, and {C}includeRaw{C} support.
   - *Validation:* Verify {C}401{C} on invalid API key, {C}200{C} on valid scrape request, {C}429{C} when hourly cap or circuit breaker is active, and cooldown reset from the Mini-UI.
5. **Phase 5 — Documentation ({C}README.md{C}, {C}.env.example{C}, {C}CHANGELOG.md{C}):**
   - Document setup instructions, security recommendations, and standalone/Docker-network pairing instructions for connecting {C}FlightSentry-Scraper{C} to {C}FlightSentry{C} ({C}v0.8.9{C}).