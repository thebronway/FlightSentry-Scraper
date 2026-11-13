# FlightSentry-Scraper REST API Specification

**Version:** `v0.1.0`  
**API Base Path:** `/api/v1`  
**Specification Standards:** OpenAPI 3.1.0 · RFC 9110 (HTTP Semantics) · RFC 6750 (Bearer Token Usage) · RFC 9457 (Problem Details) · ISO 8601 · ISO 4217 · IATA

---

## 1. Overview & Transport Architecture

FlightSentry-Scraper exposes an authenticated JSON-over-HTTP REST API that executes headless Chromium queries against Google Flights and returns normalized itinerary pricing data.

### 1.1 Base URLs
* **Same-Host / LAN Deployment:** `http://<host>:4001/api/v1`
* **Docker Compose Internal Network:** `http://flightsentry-scraper:4001/api/v1`

### 1.2 Protocol & Content Negotiation
* **Transport:** HTTP/1.1 or HTTP/2 (deploy behind a TLS-terminating reverse proxy if traversing untrusted networks).
* **Request Encoding:** `Content-Type: application/json; charset=utf-8` (required for `POST` endpoints).
* **Response Encoding:** `Content-Type: application/json; charset=utf-8`.
* **Character Set:** UTF-8 across all request and response payloads.

### 1.3 Execution Model & Client Timeouts
Unlike stateless REST APIs, `POST /api/v1/scrape` drives a single persistent Chromium browser context protected by anti-bot guardrails:
1. **Serial FIFO Queue (`concurrency = 1`):** Concurrent requests from one or more callers are queued in arrival order and executed strictly one at a time.
2. **Randomized Jitter:** Prior to browser navigation, the worker sleeps for a configured random interval (`minJitterMs` to `maxJitterMs`, default `1500ms`–`4500ms`).
3. **Browser Navigation & Hydration:** Chromium navigates to the constructed Google Flights `/travel/flights/search?tfs=...` URL, waits for network/DOM settlement, and extracts `AF_initDataCallback` (`ds:1`) structured tuples with DOM fallback.

**Recommended Consumer HTTP Timeout:** Configure client read timeouts to **at least `90,000 ms` (90 seconds)** to accommodate queue wait time behind active jobs, jitter delay, and Chromium page load.

---

## 2. Authentication (`RFC 6750`)

All `/api/v1/*` endpoints require a valid API key minted in the FlightSentry-Scraper Admin Console (`/api/admin/keys`).

### 2.1 Header Format
```http
Authorization: Bearer fss_<48_lowercase_hex_characters>
```

### 2.2 Token Properties & Security Semantics
* **Format:** 52 characters total (`fss_` prefix followed by 24 cryptographically random bytes encoded as 48 lowercase hex characters).
* **Storage:** The server stores only the display prefix (`fss_xxxxxxxx`) and an unsalted SHA-256 hex digest. Raw tokens cannot be retrieved after creation.
* **Validation:** Incoming tokens are hashed with SHA-256 and matched against non-revoked keys (`revokedAt IS NULL`). Upon match, `lastUsedAt` is updated asynchronously.
* **Failure Mode:** Missing headers, non-`Bearer` schemes, malformed tokens, or revoked keys immediately return `401 Unauthorized` without entering the scrape queue.

---

## 3. Rate Limiting, Quotas & Circuit Breaker

FlightSentry-Scraper enforces two independent protection layers before launching Chromium:

### 3.1 Rolling Window Quotas
* **Hourly Cap (`maxRequestsPerHour`):** Sliding 60-minute window (`createdAt >= now - 1 hour`). Default: `20`.
* **Daily Cap (`maxRequestsPerDay`):** Sliding 24-hour window (`createdAt >= now - 24 hours`). Default: `150`.
* **Accounting:** Every scrape attempt that passes authentication and input validation (resulting in `Success`, `SoldOut`, or `Error`) increments the rolling usage counters. Requests rejected with `400`, `401`, or `429` do not consume quota.

### 3.2 Anti-Bot Circuit Breaker
* **Trigger Conditions:** Google Flights returns an HTTP `429`, HTTP `403`, or a CAPTCHA/unusual-traffic interstitial page.
* **Effect:** The scraper immediately transitions into cooldown (`circuitBreakerActive = true`), sets `cooldownUntil` to `now + cooldownMinutes` (default `60` minutes), and rejects all subsequent `POST /api/v1/scrape` requests with `429 Too Many Requests` without opening Chromium.
* **Recovery:** Automatically clears once `now >= cooldownUntil`, or immediately when an administrator clicks **Reset Cooldown** in the Admin Console.

### 3.3 Rate Limit Response Headers (`RFC 9110`)
When a request is rejected due to quota exhaustion or an active circuit breaker, the server responds with `429 Too Many Requests` and includes the `Retry-After` HTTP header containing an ISO 8601 UTC timestamp:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 2026-11-13T15:00:00.000Z
Content-Type: application/json; charset=utf-8
```

---

## 4. Endpoint Reference

### 4.1 `GET /api/v1/health`

Returns service liveness, version metadata, circuit breaker state, current FIFO queue depth, and rolling quota consumption. Consumer applications should poll this endpoint before dispatching scrapes to determine whether to route queries to FlightSentry-Scraper or fail over to a metered API provider.

#### Request
* **Method:** `GET`
* **Path:** `/api/v1/health`
* **Headers:** `Authorization: Bearer <api_key>` (required)
* **Query Parameters:** None
* **Request Body:** None

#### Response Schema (`200 OK`)

| Field | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `status` | `string` | No | Service health indicator. Always `"ok"` when operational. |
| `version` | `string` | No | Semantic version of the running scraper service (e.g., `"0.1.0"`). |
| `timestamp` | `string` | No | Current server UTC timestamp in ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`). |
| `circuitBreakerActive` | `boolean` | No | `true` if Google anti-bot protection recently tripped cooldown; `false` otherwise. |
| `cooldownUntil` | `string \| null` | Yes | ISO 8601 UTC timestamp when active cooldown expires, or `null` when inactive. |
| `queueDepth` | `integer` | No | Number of scrape jobs currently waiting in or executing inside the serial FIFO queue (`>= 0`). |
| `limits` | `object` | No | Configured rolling rate limits. |
| `limits.maxRequestsPerHour` | `integer` | No | Maximum allowed scrapes per rolling 60-minute window. |
| `limits.maxRequestsPerDay` | `integer` | No | Maximum allowed scrapes per rolling 24-hour window. |
| `usage` | `object` | No | Live rolling quota consumption and remaining allowance. |
| `usage.requestsLastHour` | `integer` | No | Scrapes executed in the past 60 minutes. |
| `usage.requestsLast24Hours` | `integer` | No | Scrapes executed in the past 24 hours. |
| `usage.remainingHour` | `integer` | No | `max(0, maxRequestsPerHour - requestsLastHour)`. |
| `usage.remainingDay` | `integer` | No | `max(0, maxRequestsPerDay - requestsLast24Hours)`. |

#### Example Request
```bash
curl -s -X GET "http://localhost:4001/api/v1/health" \
  -H "Authorization: Bearer fss_8f9a2c4e1b0d7a6f3e5c9b2a4d8f1e0c7b6a5d4e3f2a1b0c"
```

#### Example Response (`200 OK`)
```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2026-11-13T14:15:00.412Z",
  "circuitBreakerActive": false,
  "cooldownUntil": null,
  "queueDepth": 0,
  "limits": {
    "maxRequestsPerHour": 20,
    "maxRequestsPerDay": 150
  },
  "usage": {
    "requestsLastHour": 3,
    "requestsLast24Hours": 18,
    "remainingHour": 17,
    "remainingDay": 132
  }
}
```

#### Status Codes
* `200 OK`: Telemetry returned successfully.
* `401 Unauthorized`: Missing, invalid, or revoked Bearer API key.
* `500 Internal Server Error`: Database or internal runtime error.

### 4.2 `POST /api/v1/scrape`

Executes a one-way flight search on Google Flights for a given origin, destination, departure date, cabin class, and fare tier, returning sorted itineraries and execution diagnostics.

#### Request
* **Method:** `POST`
* **Path:** `/api/v1/scrape`
* **Headers:**
  * `Authorization: Bearer <api_key>` (required)
  * `Content-Type: application/json` (required)

#### Request Body Schema

| Field | Type | Required | Default | Constraints & Validation | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `origin` | `string` | **Yes** | — | `^[A-Z]{3}$` (trimmed, uppercased) \vert{} 3-letter IATA airport code (e.g., `"IAD"`) or metropolitan area code (e.g., `"WAS"`, `"NYC"`, `"LON"`). Metro codes expand automatically to constituent airports. \vert{} \vert{} `destination` \vert{} `string` \vert{} **Yes** \vert{} — \vert{} `^[A-Z]{3}$` (trimmed, uppercased) | 3-letter IATA airport code (e.g., `"SFO"`) or metropolitan area code (e.g., `"LAX"`, `"TYO"`). |
| `departureDate` | `string` | **Yes** | — | `^\d{4}-\d{2}-\d{2}$` (valid calendar date, not in past) \vert{} One-way departure date in ISO 8601 calendar format (`YYYY-MM-DD`). \vert{} \vert{} `cabinClass` \vert{} `string` \vert{} No \vert{} `"economy"` \vert{} `"economy"` \Vert{} `"premium_economy"` \Vert{} `"business"` \Vert{} `"first"` \vert{} Target cabin class encoded into the Google Flights protobuf `tfs` payload (`1` = economy, `2` = premium_economy, `3` = business, `4` = first). \vert{} \vert{} `fareTier` \vert{} `string` \vert{} No \vert{} `"Standard"` \vert{} `"Basic"` \Vert{} `"Standard"` \vert{} Fare restriction tier. When `cabinClass === "economy"` and `fareTier === "Standard"`, sets the Google Flights **1 carry-on bag** filter to exclude Basic Economy fares. \vert{} \vert{} `currency` \vert{} `string` \vert{} No \vert{} `"USD"` \vert{} `^[A-Z]{3}$` (ISO 4217) | 3-letter currency code passed to Google Flights (`curr` parameter). |
| `maxStops` | `integer` | No | `undefined` | Integer `0` through `3` | Maximum allowed connection stops (`0` = nonstop only, `1` = 1 stop or fewer, etc.). Applied post-extraction. |
| `airline` | `string` | No | `undefined` | `^[A-Z0-9]{2}$` (trimmed, uppercased) \vert{} Single 2-character IATA carrier code filter (e.g., `"UA"`, `"F9"`, `"DL"`). \vert{} \vert{} `flightNumber` \vert{} `string` \vert{} No \vert{} `undefined` \vert{} `^[A-Z0-9]{1,8}$` | Specific flight number filter (e.g., `"687"` or `"UA687"`). Carrier prefix is stripped automatically when matching `itineraries[].flightNumber`. |
| `includedAirlines` | `string[]` | No | `undefined` | Array of `^[A-Z0-9]{2}$` \vert{} Allowlist of 2-character IATA carrier codes. If provided and non-empty, only itineraries operated by listed carriers are returned. \vert{} \vert{} `excludedAirlines` \vert{} `string[]` \vert{} No \vert{} `undefined` \vert{} Array of `^[A-Z0-9]{2}$` | Denylist of 2-character IATA carrier codes to exclude from results. |
| `includeRaw` | `boolean` | No | `false` | Boolean | When `true`, includes up to 51,200 bytes of raw `ds:1` / HTML diagnostic text in `meta.rawPayload`. |

#### Protobuf `tfs` Query Construction & Filter Semantics
1. **Metropolitan Co-Location Expansion:** Passing a metro code such as `WAS` expands into `["DCA", "IAD", "BWI"]` in the outbound protobuf slice (`field 13`). Each returned `RouteItinerary` reports the **specific operating airport** (`"DCA"`, `"IAD"`, or `"BWI"`), never the metro code.
2. **Basic vs. Standard Economy:**
   * `cabinClass: "economy"` + `fareTier: "Basic"` → Omits carry-on bag restriction; returns lowest available fares including Basic Economy (e.g., Frontier/United/Delta Basic).
   * `cabinClass: "economy"` + `fareTier: "Standard"` → Encodes `field 13 -> field 2 = 1` (1 carry-on bag) in `tfs`, filtering out Basic Economy fares at the Google Flights query level.
   * For `premium_economy`, `business`, and `first`, `fareTier` has no restrictive effect as carry-on baggage is standard.
3. **Post-Extraction Filter Precedence:** Extracted itineraries are filtered in memory in the following order, then sorted ascending by `price`:
   1. `maxStops` (`item.stops <= req.maxStops`)
   2. `includedAirlines` (`req.includedAirlines.includes(item.airline)`)
   3. `excludedAirlines` (`!req.excludedAirlines.includes(item.airline)`)
   4. `airline` (`item.airline === req.airline`)
   5. `flightNumber` (`item.flightNumber === normalizedTargetFlightNumber`)

#### Response Body Schema (`ScrapeResponse`)

| Field | Type | Nullable | Present When | Description |
| :--- | :--- | :--- | :--- | :--- |
| `status` | `string` | No | Always | Execution outcome enum: `"Success"`, `"SoldOut"`, `"RateLimited"`, or `"Error"`. |
| `provider` | `string` | No | Always | Fixed provider identifier: `"flightsentry-scraper"`. |
| `currency` | `string` | No | Always | Normalized 3-letter ISO 4217 currency code of returned prices. |
| `lowestPrice` | `number \| null` | Yes | Always | Lowest `price` among `itineraries`, or `null` when `itineraries` is empty. |
| `itineraries` | `RouteItinerary[]` | No | Always | Array of matching flight options sorted ascending by `price`. Empty (`[]`) on `SoldOut`, `RateLimited`, or `Error`. |
| `meta` | `object` | No | Always | Diagnostic execution telemetry. |
| `meta.durationMs` | `integer` | No | Always | Total server-side processing time in milliseconds (excluding FIFO queue wait before execution starts). |
| `meta.source` | `string` | No | Always | Extraction path used: `"structured"` (`ds:1` JSON hydration), `"dom"` (HTML card fallback), or `"none"`. |
| `meta.queryUrl` | `string` | No | Always | Full Google Flights search URL navigated by Chromium. |
| `meta.itineraryCount` | `integer` | No | Always | Length of `itineraries` array. |
| `meta.rawPayload` | `string` | No | `includeRaw: true` | Truncated raw `ds:1` payload or page HTML snippet (max 51,200 bytes). |
| `error` | `string` | No | `status` is `"RateLimited"` or `"Error"` | Human-readable diagnostic error message. |
| `retryAfter` | `string` | No | `status` is `"RateLimited"` | ISO 8601 UTC timestamp indicating when the caller may retry. |

#### `RouteItinerary` Object Schema

| Field | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `airline` | `string` | No | 2-character uppercase IATA carrier code (e.g., `"F9"`, `"AS"`, `"UA"`, `"WN"`). |
| `airlineName` | `string` | No | Resolved full carrier name (e.g., `"Frontier Airlines"`, `"Alaska Airlines"`, `"United Airlines"`). |
| `flightNumber` | `string` | No | Numeric flight designator of the primary (first) leg without carrier prefix (e.g., `"687"`, `"1422"`). May be `""` if extracted via DOM fallback. |
| `origin` | `string` | No | 3-letter uppercase IATA code of the departure airport (e.g., `"DCA"`). |
| `destination` | `string` | No | 3-letter uppercase IATA code of the final arrival airport (e.g., `"SFO"`). |
| `price` | `number` | No | Total one-way fare in `currency` (e.g., `219`). |
| `departureTime` | `string` | No | Local departure date and 24-hour time formatted as `"YYYY-MM-DD HH:MM"` (e.g., `"2026-12-13 13:40"`). |
| `arrivalTime` | `string` | No | Local arrival date and 24-hour time formatted as `"YYYY-MM-DD HH:MM"` (e.g., `"2026-12-13 19:31"`). Reflects `+1` day rollovers on overnight flights. |
| `duration` | `string` | No | Human-readable total elapsed duration (e.g., `"8h 51m"`, `"6h 22m"`, `"45m"`). |
| `durationMinutes` | `integer` | No | Total elapsed duration in integer minutes (e.g., `531`, `382`). |
| `stops` | `integer` | No | Number of intermediate stops (`0` = nonstop, `1` = 1 stop, etc.). |
| `isNonstop` | `boolean` | No | Convenience boolean equal to `stops === 0`. |
| `layoverAirports` | `string[]` | No | Ordered list of 3-letter uppercase IATA codes for intermediate connection airports (e.g., `["DEN"]`). Empty (`[]`) when `stops === 0`. |

### 4.3 HTTP Status Code & Outcome Matrix

| HTTP Status | `body.status` | Condition | Consumer Action |
| :--- | :--- | :--- | :--- |
| `200 OK` | `"Success"` | Scrape succeeded and `itineraries.length > 0`. | Persist prices, update lowest fare, evaluate alert rules. |
| `200 OK` | `"SoldOut"` | Google Flights loaded cleanly, but 0 itineraries matched the route/cabin/fare/airline filters. | Record `SoldOut` check; do not mark provider unhealthy. |
| `400 Bad Request` | `"Error"` | Request JSON failed Zod schema validation (invalid IATA code, past date, invalid enum). | Fix caller payload; do not retry unchanged request. |
| `401 Unauthorized` | `"Error"` | Missing, malformed, or revoked `Authorization: Bearer` API key. | Surface authentication error to user; halt queries to this source until key is updated. |
| `429 Too Many Requests` | `"RateLimited"` | Rolling hourly/daily quota exhausted **or** anti-bot circuit breaker is active. | Respect `retryAfter` / `Retry-After` header; fail over to next configured data source. |
| `500 Internal Server Error` | `"Error"` | Unhandled server or SQLite persistence exception. | Log failure and fail over to next data source. |
| `502 Bad Gateway` | `"Error"` | Chromium navigation timeout, network failure, or upstream Google Flights block/CAPTCHA (which also trips the circuit breaker). | Log failure and fail over to next data source. |

### 4.4 Complete Request & Response Examples

#### Example A: `200 OK` — `Success` (Standard Economy with Carry-On Filter)
**Request:**
```json
{
  "origin": "WAS",
  "destination": "SFO",
  "departureDate": "2026-12-13",
  "cabinClass": "economy",
  "fareTier": "Standard",
  "currency": "USD"
}
```

**Response (`200 OK`):**
```json
{
  "status": "Success",
  "provider": "flightsentry-scraper",
  "currency": "USD",
  "lowestPrice": 219,
  "itineraries": [
    {
      "airline": "F9",
      "airlineName": "Frontier Airlines",
      "flightNumber": "687",
      "origin": "DCA",
      "destination": "SFO",
      "price": 219,
      "departureTime": "2026-12-13 13:40",
      "arrivalTime": "2026-12-13 19:31",
      "duration": "8h 51m",
      "durationMinutes": 531,
      "stops": 1,
      "isNonstop": false,
      "layoverAirports": ["DEN"]
    },
    {
      "airline": "AS",
      "airlineName": "Alaska Airlines",
      "flightNumber": "1422",
      "origin": "DCA",
      "destination": "SFO",
      "price": 269,
      "departureTime": "2026-12-13 18:59",
      "arrivalTime": "2026-12-13 22:21",
      "duration": "6h 22m",
      "durationMinutes": 382,
      "stops": 0,
      "isNonstop": true,
      "layoverAirports": []
    }
  ],
  "meta": {
    "durationMs": 4120,
    "source": "structured",
    "queryUrl": "[https://www.google.com/travel/flights/search?tfs=CBwQAhpCEgoyMDI2LTEyLTEzagcIARIDRENBagcIARIDSUFEagcIARIDQldJcgwIAxIIL20vMGQ2bHBAAUgBcAGYAQI&hl=en&curr=USD](https://www.google.com/travel/flights/search?tfs=CBwQAhpCEgoyMDI2LTEyLTEzagcIARIDRENBagcIARIDSUFEagcIARIDQldJcgwIAxIIL20vMGQ2bHBAAUgBcAGYAQI&hl=en&curr=USD)",
    "itineraryCount": 2
  }
}
```

#### Example B: `200 OK` — `SoldOut`
```json
{
  "status": "SoldOut",
  "provider": "flightsentry-scraper",
  "currency": "USD",
  "lowestPrice": null,
  "itineraries": [],
  "meta": {
    "durationMs": 3890,
    "source": "structured",
    "queryUrl": "[https://www.google.com/travel/flights/search?tfs=](https://www.google.com/travel/flights/search?tfs=)...",
    "itineraryCount": 0
  }
}
```

#### Example C: `400 Bad Request` — Validation Error
```json
{
  "status": "Error",
  "provider": "flightsentry-scraper",
  "currency": "USD",
  "lowestPrice": null,
  "itineraries": [],
  "meta": {
    "durationMs": 2,
    "source": "none",
    "queryUrl": "",
    "itineraryCount": 0
  },
  "error": "Validation failed: origin: Must be a 3-letter uppercase IATA airport or metro code"
}
```

#### Example D: `401 Unauthorized` — Invalid or Revoked API Key
```json
{
  "status": "Error",
  "provider": "flightsentry-scraper",
  "currency": "USD",
  "lowestPrice": null,
  "itineraries": [],
  "meta": {
    "durationMs": 1,
    "source": "none",
    "queryUrl": "",
    "itineraryCount": 0
  },
  "error": "Unauthorized: Invalid or revoked API key"
}
```

#### Example E: `429 Too Many Requests` — Quota Exhausted or Circuit Breaker Active
**Headers:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 2026-11-13T15:00:00.000Z
Content-Type: application/json; charset=utf-8
```
**Body:**
```json
{
  "status": "RateLimited",
  "provider": "flightsentry-scraper",
  "currency": "USD",
  "lowestPrice": null,
  "itineraries": [],
  "meta": {
    "durationMs": 1,
    "source": "none",
    "queryUrl": "",
    "itineraryCount": 0
  },
  "error": "Rate limit exceeded: Rolling hourly limit (20 requests/hour) reached",
  "retryAfter": "2026-11-13T15:00:00.000Z"
}
```

#### Example F: `502 Bad Gateway` — Upstream Anti-Bot Challenge
```json
{
  "status": "Error",
  "provider": "flightsentry-scraper",
  "currency": "USD",
  "lowestPrice": null,
  "itineraries": [],
  "meta": {
    "durationMs": 6410,
    "source": "none",
    "queryUrl": "[https://www.google.com/travel/flights/search?tfs=](https://www.google.com/travel/flights/search?tfs=)...",
    "itineraryCount": 0
  },
  "error": "Google Flights returned an anti-bot CAPTCHA challenge; circuit breaker activated for 60 minutes"
}
```

---

## 5. Consumer Implementation Guide (TypeScript)

When integrating FlightSentry-Scraper into an external flight tracker (such as **FlightSentry**):

1. **Normalize Base URL:** Strip trailing slashes from the user-configured endpoint URL (e.g., `http://flightsentry-scraper:4001`) before appending `/api/v1/health` or `/api/v1/scrape`.
2. **Pre-Flight Health Gate:** Before invoking `/api/v1/scrape`, call `GET /api/v1/health` with a short timeout (`5,000 ms`). If `circuitBreakerActive === true`, `usage.remainingHour === 0`, or `usage.remainingDay === 0`, skip the scraper immediately and fail over to the next provider without waiting on a `429`.
3. **Specific Flight vs. Route Searches:**
   * For **Route Tracking**, omit `airline` and `flightNumber` (optionally pass `includedAirlines` / `excludedAirlines` and `maxStops`). Pick `itineraries[0]` as the lowest fare (since `itineraries` is pre-sorted ascending by `price`).
   * For **Specific Flight Tracking**, pass both `airline` (e.g., `"UA"`) and `flightNumber` (e.g., `"1492"` or `"UA1492"`). Inspect `itineraries[0]` for that exact flight's fare.
4. **Multi-Airport Origins/Destinations:** If the consumer tracks `"WAS"` → `"SFO"`, `itineraries[0].origin` will contain the winning specific airport (`"DCA"`, `"IAD"`, or `"BWI"`). Preserve the parent watch's `"WAS"` designation while recording the winning leg's `"DCA"` airport code in historical check logs.

### 5.1 Reference TypeScript Adapter

```typescript
export interface FlightSentryScraperConfig {
  baseUrl: string; // e.g. "http://flightsentry-scraper:4001"
  apiKey: string;  // e.g. "fss_..."
  timeoutMs?: number;
}

export interface ScraperHealthResponse {
  status: 'ok';
  version: string;
  timestamp: string;
  circuitBreakerActive: boolean;
  cooldownUntil: string | null;
  queueDepth: number;
  limits: {
    maxRequestsPerHour: number;
    maxRequestsPerDay: number;
  };
  usage: {
    requestsLastHour: number;
    requestsLast24Hours: number;
    remainingHour: number;
    remainingDay: number;
  };
}

export interface ScraperQueryRequest {
  origin: string;
  destination: string;
  departureDate: string;
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
  fareTier?: 'Basic' | 'Standard';
  currency?: string;
  maxStops?: number;
  airline?: string;
  flightNumber?: string;
  includedAirlines?: string[];
  excludedAirlines?: string[];
  includeRaw?: boolean;
}

export interface ScraperItinerary {
  airline: string;
  airlineName: string;
  flightNumber: string;
  origin: string;
  destination: string;
  price: number;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  durationMinutes: number;
  stops: number;
  isNonstop: boolean;
  layoverAirports: string[];
}

export interface ScraperQueryResponse {
  status: 'Success' | 'SoldOut' | 'RateLimited' | 'Error';
  provider: 'flightsentry-scraper';
  currency: string;
  lowestPrice: number | null;
  itineraries: ScraperItinerary[];
  meta: {
    durationMs: number;
    source: 'structured' | 'dom' | 'none';
    queryUrl: string;
    itineraryCount: number;
    rawPayload?: string;
  };
  error?: string;
  retryAfter?: string;
}

export class FlightSentryScraperClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(config: FlightSentryScraperConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey.trim();
    this.timeoutMs = config.timeoutMs ?? 90_000;
  }

  async checkHealth(): Promise<ScraperHealthResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/health`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      throw new Error(`Health check failed with HTTP ${res.status}`);
    }

    return (await res.json()) as ScraperHealthResponse;
  }

  async scrape(params: ScraperQueryRequest): Promise<ScraperQueryResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/scrape`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    let payload: ScraperQueryResponse | null = null;
    try {
      payload = (await res.json()) as ScraperQueryResponse;
    } catch {
      // Non-JSON upstream proxy error
    }

    if (payload && typeof payload.status === 'string') {
      return payload;
    }

    return {
      status: res.status === 429 ? 'RateLimited' : 'Error',
      provider: 'flightsentry-scraper',
      currency: params.currency ?? 'USD',
      lowestPrice: null,
      itineraries: [],
      meta: {
        durationMs: 0,
        source: 'none',
        queryUrl: '',
        itineraryCount: 0,
      },
      error: `Unexpected HTTP ${res.status} from FlightSentry-Scraper`,
    };
  }
}
```

---

## 6. OpenAPI 3.1.0 Specification (`openapi.yaml`)

```yaml
openapi: 3.1.0
info:
  title: FlightSentry-Scraper API
  version: 0.1.0
  description: |
    Self-hosted headless Chromium microservice for scraping Google Flights itineraries,
    protected by Bearer API keys, serial FIFO queueing, rolling quotas, and an anti-bot circuit breaker.
  license:
    name: MIT
servers:
  - url: http://localhost:4001/api/v1
    description: Local or LAN Docker container
  - url: http://flightsentry-scraper:4001/api/v1
    description: Internal Docker Compose network
security:
  - BearerAuth: []
paths:
  /health:
    get:
      operationId: getHealth
      summary: Retrieve scraper health, circuit breaker state, queue depth, and rolling quotas
      tags:
        - Telemetry
      responses:
        "200":
          description: Service telemetry and quota counters
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/HealthResponse"
        "401":
          description: Missing, invalid, or revoked Bearer API key
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScrapeResponse"
        "500":
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScrapeResponse"
  /scrape:
    post:
      operationId: scrapeFlights
      summary: Execute a one-way Google Flights search
      tags:
        - Scraping
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ScrapeRequest"
      responses:
        "200":
          description: Scrape completed (either Success with itineraries or SoldOut with empty list)
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScrapeResponse"
        "400":
          description: Request payload failed Zod schema validation
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScrapeResponse"
        "401":
          description: Missing, invalid, or revoked Bearer API key
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScrapeResponse"
        "429":
          description: Rolling hourly/daily quota exhausted or anti-bot circuit breaker active
          headers:
            Retry-After:
              description: ISO 8601 UTC timestamp when the client may retry
              schema:
                type: string
                format: date-time
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScrapeResponse"
        "500":
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScrapeResponse"
        "502":
          description: Upstream Chromium navigation failure or Google Flights anti-bot challenge
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ScrapeResponse"
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: fss_<48-hex-chars>
  schemas:
    HealthResponse:
      type: object
      required:
        - status
        - version
        - timestamp
        - circuitBreakerActive
        - cooldownUntil
        - queueDepth
        - limits
        - usage
      properties:
        status:
          type: string
          enum: ["ok"]
        version:
          type: string
          example: "0.1.0"
        timestamp:
          type: string
          format: date-time
        circuitBreakerActive:
          type: boolean
        cooldownUntil:
          type: ["string", "null"]
          format: date-time
        queueDepth:
          type: integer
          minimum: 0
        limits:
          type: object
          required:
            - maxRequestsPerHour
            - maxRequestsPerDay
          properties:
            maxRequestsPerHour:
              type: integer
              minimum: 1
            maxRequestsPerDay:
              type: integer
              minimum: 1
        usage:
          type: object
          required:
            - requestsLastHour
            - requestsLast24Hours
            - remainingHour
            - remainingDay
          properties:
            requestsLastHour:
              type: integer
              minimum: 0
            requestsLast24Hours:
              type: integer
              minimum: 0
            remainingHour:
              type: integer
              minimum: 0
            remainingDay:
              type: integer
              minimum: 0
    ScrapeRequest:
      type: object
      required:
        - origin
        - destination
        - departureDate
      properties:
        origin:
          type: string
          pattern: "^[A-Z]{3}$"
          description: 3-letter uppercase IATA airport or metro area code (e.g., WAS, JFK)
          example: "WAS"
        destination:
          type: string
          pattern: "^[A-Z]{3}$"
          description: 3-letter uppercase IATA airport or metro area code (e.g., SFO, LAX)
          example: "SFO"
        departureDate:
          type: string
          format: date
          pattern: "^\\d{4}-\\d{2}-\\d{2}$"
          description: One-way departure date in YYYY-MM-DD format
          example: "2026-12-13"
        cabinClass:
          type: string
          enum: ["economy", "premium_economy", "business", "first"]
          default: "economy"
        fareTier:
          type: string
          enum: ["Basic", "Standard"]
          default: "Standard"
          description: Standard enforces 1 carry-on bag in economy to exclude Basic Economy fares
        currency:
          type: string
          pattern: "^[A-Z]{3}$"
          default: "USD"
          example: "USD"
        maxStops:
          type: integer
          minimum: 0
          maximum: 3
          description: Maximum intermediate stops allowed (0 = nonstop)
        airline:
          type: string
          pattern: "^[A-Z0-9]{2}$"
          description: 2-character uppercase IATA carrier code filter
          example: "UA"
        flightNumber:
          type: string
          pattern: "^[A-Z0-9]{1,8}$"
          description: Specific flight number filter (e.g., "687" or "UA687")
          example: "687"
        includedAirlines:
          type: array
          items:
            type: string
            pattern: "^[A-Z0-9]{2}$"
        excludedAirlines:
          type: array
          items:
            type: string
            pattern: "^[A-Z0-9]{2}$"
        includeRaw:
          type: boolean
          default: false
    RouteItinerary:
      type: object
      required:
        - airline
        - airlineName
        - flightNumber
        - origin
        - destination
        - price
        - departureTime
        - arrivalTime
        - duration
        - durationMinutes
        - stops
        - isNonstop
        - layoverAirports
      properties:
        airline:
          type: string
          example: "F9"
        airlineName:
          type: string
          example: "Frontier Airlines"
        flightNumber:
          type: string
          example: "687"
        origin:
          type: string
          pattern: "^[A-Z]{3}$"
          example: "DCA"
        destination:
          type: string
          pattern: "^[A-Z]{3}$"
          example: "SFO"
        price:
          type: number
          example: 219
        departureTime:
          type: string
          pattern: "^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$"
          example: "2026-12-13 13:40"
        arrivalTime:
          type: string
          pattern: "^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$"
          example: "2026-12-13 19:31"
        duration:
          type: string
          example: "8h 51m"
        durationMinutes:
          type: integer
          example: 531
        stops:
          type: integer
          minimum: 0
          example: 1
        isNonstop:
          type: boolean
          example: false
        layoverAirports:
          type: array
          items:
            type: string
            pattern: "^[A-Z]{3}$"
          example: ["DEN"]
    ScrapeResponse:
      type: object
      required:
        - status
        - provider
        - currency
        - lowestPrice
        - itineraries
        - meta
      properties:
        status:
          type: string
          enum: ["Success", "SoldOut", "RateLimited", "Error"]
        provider:
          type: string
          enum: ["flightsentry-scraper"]
        currency:
          type: string
          example: "USD"
        lowestPrice:
          type: ["number", "null"]
          example: 219
        itineraries:
          type: array
          items:
            $ref: "#/components/schemas/RouteItinerary"
        meta:
          type: object
          required:
            - durationMs
            - source
            - queryUrl
            - itineraryCount
          properties:
            durationMs:
              type: integer
              example: 4120
            source:
              type: string
              enum: ["structured", "dom", "none"]
            queryUrl:
              type: string
            itineraryCount:
              type: integer
            rawPayload:
              type: string
        error:
          type: string
        retryAfter:
          type: string
          format: date-time
```

---

## 7. Metropolitan Co-Location & Carrier Normalization Reference

### 7.1 Supported Metropolitan Area Codes (`IATA`)

When `origin` or `destination` is supplied as a supported 3-letter IATA metropolitan area code, `urlBuilder.ts` expands the token into its constituent commercial airports inside the Google Flights protobuf `tfs` slice (`field 13` for origin, `field 14` for destination). Individual airport codes pass through unchanged.

| Metro Code | Metropolitan Region | Expanded Airport Codes (`IATA`) |
| :--- | :--- | :--- |
| `WAS` | Washington, D.C. | `["DCA", "IAD", "BWI"]` |
| `NYC` | New York City, NY | `["JFK", "LGA", "EWR"]` |
| `CHI` | Chicago, IL | `["ORD", "MDW"]` |
| `LON` | London, United Kingdom | `["LHR", "LGW", "STN", "LTN", "LCY"]` |
| `PAR` | Paris, France | `["CDG", "ORY"]` |
| `TYO` | Tokyo, Japan | `["HND", "NRT"]` |
| `OSA` | Osaka, Japan | `["KIX", "ITM"]` |
| `SEL` | Seoul, South Korea | `["ICN", "GMP"]` |
| `MIL` | Milan, Italy | `["MXP", "LIN", "BGY"]` |
| `ROM` | Rome, Italy | `["FCO", "CIA"]` |
| `STO` | Stockholm, Sweden | `["ARN", "BMA"]` |
| `YTO` | Toronto, Canada | `["YYZ", "YTZ"]` |
| `YMQ` | Montreal, Canada | `["YUL", "YHU"]` |
| `BJS` | Beijing, China | `["PEK", "PKX"]` |
| `SHA` | Shanghai, China | `["PVG", "SHA"]` |
| `SAO` | São Paulo, Brazil | `["GRU", "CGH", "VCP"]` |
| `RIO` | Rio de Janeiro, Brazil | `["GIG", "SDU"]` |
| `BUE` | Buenos Aires, Argentina | `["EZE", "AEP"]` |
| `MOW` | Moscow, Russia | `["SVO", "DME", "VKO"]` |

**Response Airport Semantics:** Returned `RouteItinerary.origin` and `RouteItinerary.destination` fields always report the exact operating airport IATA code (e.g., `"DCA"` or `"IAD"`), never the metropolitan group code (`"WAS"`).

---

### 7.2 Carrier & Flight Number Normalization Rules

1. **Carrier Code (`airline`):** Normalized to 2-character uppercase IATA designator (`^[A-Z0-9]{2}$`), such as `"UA"`, `"DL"`, `"AA"`, `"AS"`, `"WN"`, `"B6"`, `"F9"`, `"NK"`.
2. **Carrier Name (`airlineName`):** Resolved from Google Flights' `ds:1` leg metadata (`firstLeg[22][3]`) or `summary[1][0]`, falling back to an internal IATA carrier lookup table when extracted via DOM cards.
3. **Flight Number (`flightNumber`):**
   * Extracted from `firstLeg[22][1]` as the numeric designator string without carrier prefix (e.g., `"687"` rather than `"F9 687"` or `"F9687"`).
   * When filtering via `ScrapeRequest.flightNumber`, leading carrier prefixes and whitespace are stripped automatically (e.g., `"UA 1492"`, `"UA1492"`, and `"1492"` all match `itinerary.flightNumber === "1492"`).
   * For multi-segment itineraries (`stops >= 1`), `airline` and `flightNumber` represent the **first (originating) operating flight segment**.

---

### 7.3 End of Specification
*Document Version: `v0.1.0` · FlightSentry-Scraper REST API*