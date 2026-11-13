# FlightSentry-Scraper

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-v0.1.5-blue.svg)
![Docker](https://img.shields.io/docker/pulls/thebronway/flightsentry-scraper?logo=docker)

### A self-hosted headless Chromium scraper microservice for FlightSentry.
Built with Next.js, Playwright, SQLite, and Docker.

> **Note:** This app is in active development, features and functionalities will vary.

FlightSentry-Scraper runs an isolated Chromium instance to scrape Google Flights and exposes a rate-limited, API-key-authenticated REST API (`/api/v1`) consumed by the main FlightSentry application.

**GitHub:** [thebronway/FlightSentry-Scraper](https://github.com/thebronway/FlightSentry-Scraper) | [Report a Bug or Request a Feature](https://github.com/thebronway/FlightSentry-Scraper/issues)  
**API Specs:** [API Spec](./docs/API_SPEC.MD).  
**Docker Hub:** [thebronway/flightsentry-scraper](https://hub.docker.com/r/thebronway/flightsentry-scraper)  
**Roadmap:** See planned features in the [Project Roadmap](./ROADMAP.md).  
**Changelog:** Review past releases in the [Changelog](./CHANGELOG.md).  
**Support:** Find this useful? [Support my work (Buy me a coffee)](https://buymeacoffee.com/brianconway).

## Features
- **Headless Chromium Scraper:** Persistent stealth browser context with Google consent handling, `ds:1` payload extraction, and DOM fallback into `RouteItinerary[]`.
- **Fare & Cabin Support:** Encodes origin/destination IATA and metropolitan area codes (`WAS`, `NYC`, `LON`, etc.), cabin classes (`economy`, `premium_economy`, `business`, `first`), and `Basic` vs `Standard` (carry-on bag) filtering.
- **Anti-Bot Guardrails:** Strict serial FIFO queue (`concurrency = 1`), randomized inter-request jitter, rolling hourly/daily query caps, and automatic CAPTCHA/HTTP 429/403 circuit breaker with manual cooldown reset.
- **Defense-in-Depth Security:** Mandatory first-run `scrypt` admin password setup, HMAC-SHA256 signed `HttpOnly` session cookies, login rate limiting, SHA-256 hashed `fss_...` API keys, Zod input validation, strict Google-domain `page.route()` network isolation, and non-root container execution.
- **Admin Console:** Dark Gunmetal web UI on port `4001` for API key lifecycle management, guardrail and proxy configuration, live test scrapes, and diagnostic scrape logs.

## Data Sources
FlightSentry-Scraper connects directly to Google Flights via headless Chromium and exposes `/api/v1/health` and `/api/v1/scrape` for the main FlightSentry application.

## Author
Check out my other projects at [brian.conway.im](https://brian.conway.im/).
Find this or any of my other projects useful or helpful? [Support my work (Buy me a coffee)](https://buymeacoffee.com/brianconway).

## Acknowledgments
This project was coded with AI assistance, but fully reviewed, tested, and approved by hand. See [AIACKNOWLEDGMENT.md](AIACKNOWLEDGMENT.md) for details.

*This software is provided "as is", without warranty of any kind, express or implied.*