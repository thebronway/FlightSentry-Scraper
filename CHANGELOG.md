# FlightSentry-Scraper Changelog

*Last updated: 2026-11-13*  
*Current Version: v0.1.5*

## Changelog

### Release v0.1.5
- Updated `POST /api/v1/scrape` validation and protobuf `tfs` encoding to accept single 3-letter IATA strings or arrays of 1 to 8 unique airport codes in a single browser navigation (1 quota unit), removing server-side metro code expansion tables.
- Added `maxLayoverMinutes` and per-segment `legs` (`RouteSegment[]`) extraction to `RouteItinerary` during `ds:1` parsing.
- Updated `ScrapeRequest.flightNumber` filtering to match against any operating segment in `itinerary.legs` while preserving segment 1 on top-level `airline` and `flightNumber`.
- Fixed `cleanFlightNumber` to preserve full numeric flight designators without stripping leading digits.
- Updated `docs/API_SPEC.MD` and the embedded OpenAPI 3.1.0 specification for `v0.1.5`.

### Release v0.1.0
- Initial release of FlightSentry-Scraper as a standalone Dockerized Next.js 14 and Playwright Chromium microservice.
- Added SQLite persistence (`settings`, `api_keys`, `scrape_logs`) with WAL mode, lazy initialization, and automatic log pruning.
- Added mandatory first-run `scrypt` admin password setup, HMAC-SHA256 signed `HttpOnly` session cookies, per-IP login rate limiting, and SHA-256 hashed `fss_...` API key management.
- Added persistent stealth Chromium manager with `page.route()` Google-domain network isolation, non-essential asset blocking, consent cookie seeding, and HTTP disk cache pruning.
- Added serial FIFO scrape queue (`concurrency = 1`), configurable jitter delays, rolling hourly/daily query caps, and automatic CAPTCHA/429/403 circuit breaker with manual reset.
- Added protobuf `tfs` Google Flights URL builder with metropolitan area code expansion (`WAS`, `NYC`, `LON`, etc.), cabin class encoding, and `Basic` vs `Standard` carry-on filtering, paired with `ds:1` and DOM itinerary extraction.
- Added `GET /api/v1/health` and `POST /api/v1/scrape` REST endpoints with Zod validation and optional truncated `includeRaw` payload inspection.
- Added Admin Console UI with Engine Status & Circuit Breaker controls, API Keys manager, Guardrails & Proxy settings, Live Test Scrape runner, and Scrape Logs viewer.