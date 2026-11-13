### 1. Basic Economy vs. Standard Economy

* **Test 1A — Economy Basic vs. Standard (Legacy Carrier Route):**
* **Search A:** `origin: ["IAD"]`, `destination: ["SFO"]`, `cabinClass: "economy"`, `fareTier: "Basic"`
* **Search B:** Same route/date, `cabinClass: "economy"`, `fareTier: "Standard"`
* **Expected:** Search B `lowestPrice` is higher than Search A `lowestPrice` on routes where United/Delta/American sell Basic Economy, and Search B excludes Basic Economy fares.


* **Test 1B — Non-Economy Cabins Ignore `fareTier`:**
* **Search A:** `cabinClass: "business"` (or `"premium_economy"` / `"first"`), `fareTier: "Basic"`
* **Search B:** Same route/date/cabin, `fareTier: "Standard"`
* **Expected:** Search A and Search B return identical `lowestPrice` and `itineraries` (matching `SerpAPI` and `SearchApi.io`, where Basic Economy exclusion only applies to `economy`).





---

### 2. Single Airport vs. Multi-Airport Array

* **Test 2A — Single Airport Isolation:**
* **Search:** `origin: ["DCA"]`, `destination: ["SFO"]`
* **Expected:** Every item in `itineraries` has `origin === "DCA"` and `destination === "SFO"`.


* **Test 2B — Multi-Airport Array Expansion & Quota Accounting:**
* **Search:** `origin: ["DCA", "IAD", "BWI"]`, `destination: ["SFO", "OAK", "SJC"]`
* **Expected:**
* `lowestPrice` is `<=` the lowest price returned when querying any single pair individually (e.g., `DCA -> SFO`).
* Every returned itinerary reports its exact operating airports (`"DCA"`, `"IAD"`, or `"BWI"` $\rightarrow$ `"SFO"`, `"OAK"`, or `"SJC"`), never a metro code.
* `GET /api/v1/health` shows `usage.requestsLastHour` and `usage.requestsLast24Hours` incremented by **1** (not 9).





---

### 3. Stops & Layover Telemetry

* **Test 3A — Nonstop Only vs. 1-Stop Allowed:**
* **Search A:** `maxStops: 0`
* **Search B:** Same route/date, `maxStops: 1`
* **Expected:**
* Search A returns only itineraries with `stops === 0`, `isNonstop === true`, `layoverAirports: []`, and `maxLayoverMinutes: null` (or `0`).
* Search B returns itineraries with `stops <= 1` and `lowestPrice <=` Search A `lowestPrice`.




* **Test 3B — Connecting Layover Fields:**
* **Search:** Any 1-stop route with `maxStops: 1`
* **Expected:** For every itinerary with `stops === 1`, `isNonstop === false`, `layoverAirports` contains 1 valid 3-letter IATA airport code, and `maxLayoverMinutes` is an integer `> 0` matching Google Flights' displayed connection duration.



---

### 4. Airline & Specific Flight Number Filtering

* **Test 4A — Allowlist vs. Denylist:**
* **Search A:** `includedAirlines: ["UA", "DL"]`
* **Search B:** Same route/date, `excludedAirlines: ["UA", "DL"]`
* **Expected:** Search A returns only `"UA"` and `"DL"` itineraries; Search B returns zero `"UA"` or `"DL"` itineraries.


* **Test 4B — Flight Number Format Normalization:**
* **Search A:** `airline: "UA"`, `flightNumber: "1492"`
* **Search B:** `airline: "UA"`, `flightNumber: "UA1492"`
* **Search C:** `airline: "UA"`, `flightNumber: "UA 1492"`
* **Expected:** All three return the exact same `lowestPrice` and itinerary with `itinerary.flightNumber === "1492"`.


* **Test 4C — Connecting Second-Leg Flight Match:**
* **Search:** `airline` and `flightNumber` of a flight operating as segment 2 of a 1-stop itinerary.
* **Expected:** Returns `status: "Success"` with that itinerary, where `legs[1]` matches the requested carrier and flight number.


* **Test 4D — Non-Existent Flight Number on Valid Route:**
* **Search:** Valid `origin`, `destination`, `departureDate`, with `airline: "UA"`, `flightNumber: "99999"`
* **Expected:** HTTP `200 OK` with `status: "SoldOut"`, `lowestPrice: null`, and `itineraries: []` (not `400` or `500`).



---

### 5. Timestamp, Duration & Currency Format Parity

* **Test 5A — Overnight Redeye Timestamps:**
* **Search:** West Coast to East Coast route (`LAX -> JFK`) with late-night departures.
* **Expected:** `departureTime` is `"YYYY-MM-DD HH:MM"` (e.g., `"2026-12-13 23:15"`) and `arrivalTime` reflects the `+1` day rollover (`"2026-12-14 07:35"`) in 24-hour format so `FlightSentry`'s `isRedeyeFlight()` and time-window filters match `SerpAPI` and `SearchApi.io`.




* **Test 5B — Duration Consistency:**
* **Search:** Any valid route.
* **Expected:** `durationMinutes` equals `(hours * 60) + minutes` parsed from `duration` (e.g., `"6h 22m"` $\rightarrow$ `382`).


* **Test 5C — Currency Conversion:**
* **Search A:** `currency: "USD"`
* **Search B:** Same route/date, `currency: "EUR"`
* **Expected:** Search B returns `currency: "EUR"` with EUR-denominated prices matching Google Flights' EUR display.



---

### 6. Live Cross-Provider Parity Check (Against `SerpAPI` / `SearchApi.io` / `HasData`)

* **Test 6 — Side-by-Side Output Comparison:**
* Run the same query (`origin`, `destination`, `departureDate`, `cabinClass: "economy"`, `fareTier: "Standard"`, `currency: "USD"`) on `FlightSentry-Scraper` and one metered provider (`SerpAPI`, `SearchApi.io`, or `HasData`) back-to-back:


* **Expected:**
* `lowestPrice` matches (within `$1–$2` rounding).
* Winning `airline` and `flightNumber` match.
* For matching itineraries across both responses: `stops`, `layoverAirports`, `departureTime`, `arrivalTime`, and `maxLayoverMinutes` match.







---

### 7. Auth, Validation & Rate-Limit Contract Tests

* **Test 7A — Invalid / Missing Bearer Token:**
* **Search:** `POST /api/v1/scrape` or `GET /api/v1/health` with missing or invalid `Authorization` header.
* **Expected:** HTTP `401 Unauthorized`, `status: "Error"`, no quota consumed.


* **Test 7B — Invalid Input Payload:**
* **Search:** `origin: ["INVALID"]` or past `departureDate`.
* **Expected:** HTTP `400 Bad Request`, `status: "Error"`, no quota consumed.


* **Test 7C — Quota Exhaustion / Circuit Breaker Cooldown:**
* **Condition:** Rolling hourly/daily cap reached or circuit breaker active.
* **Expected:**
* `GET /api/v1/health` returns `200 OK` with `circuitBreakerActive: true` or `remainingHour === 0` / `remainingDay === 0`.
* `POST /api/v1/scrape` returns HTTP `429 Too Many Requests`, `Retry-After` ISO UTC header, `status: "RateLimited"`, and `retryAfter` field without launching Chromium.