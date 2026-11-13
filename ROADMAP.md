# FlightSentry-Scraper Roadmap

*Last updated: 2026-11-13*  
*Current Version: v0.1.0*

## Overview
This document tracks planned improvements, enhancements, and technical debt for FlightSentry-Scraper

## Release Roadmap

### Release v0.1.5: Multi-Airport Array Inputs, Layover Duration & Multi-Segment Matching
- **Multi-Airport Array Input (`POST /api/v1/scrape`)**
  - Update `ScrapeRequest` Zod validation for `origin` and `destination` to accept an array of 1 to 8 unique 3-letter uppercase IATA airport codes (`string[]`, each matching `^[A-Z]{3}$`, trimmed and uppercased), while retaining single 3-letter string support (`^[A-Z]{3}$`).
  - Deduplicate airport codes and encode all origin codes into `tfs` protobuf `field 13` and all destination codes into `field 14` so multi-airport queries execute in one browser navigation and consume 1 quota unit.
  - Remove metro code expansion tables from `urlBuilder.ts`; callers resolve metro and regional clusters to airport arrays before calling `/api/v1/scrape`.
  - Keep response airport behavior unchanged: `RouteItinerary.origin` and `RouteItinerary.destination` emit the operating airport IATA code.
- **Maximum Layover Duration (`RouteItinerary.maxLayoverMinutes`)**
  - Add `maxLayoverMinutes?: number | null` to `RouteItinerary` (integer minutes of the longest connection between segments; `null` or `0` when `stops === 0`).
  - Calculate connection gaps in minutes between consecutive segments during `ds:1` extraction and set `maxLayoverMinutes` to the maximum connection duration when `stops >= 1`.
- **Multi-Segment Operating Legs (`RouteItinerary.legs`)**
  - Add `legs?: RouteSegment[]` to `RouteItinerary` with fields:
    - `airline` (`string`): 2-character uppercase IATA carrier code
    - `flightNumber` (`string`): Numeric flight designator without carrier prefix
    - `origin` (`string`): 3-character uppercase IATA departure airport
    - `destination` (`string`): 3-character uppercase IATA arrival airport
    - `departureTime` (`string`): Local departure timestamp (`"YYYY-MM-DD HH:MM"`)
    - `arrivalTime` (`string`): Local arrival timestamp (`"YYYY-MM-DD HH:MM"`)
    - `durationMinutes` (`integer`): Segment flight duration in minutes
  - Update server-side `ScrapeRequest.flightNumber` filtering to match against any segment in `itinerary.legs`, while keeping top-level `itinerary.airline` and `itinerary.flightNumber` set to the first segment.
- **OpenAPI & Specification Sync**
  - Update `openapi.yaml` and the REST API specification document to match the updated `ScrapeRequest`, `RouteItinerary`, and `RouteSegment` schemas.
- **Validation Checklist**
  - **Multi-Airport Array:** `POST /api/v1/scrape` with `"origin": ["DFW", "DAL"]` and `"destination": ["JFK", "LGA", "EWR"]` returns `200 OK`, consumes 1 quota unit, and reports operating airport codes on each `RouteItinerary`.
  - **Basic vs. Standard Economy:** Querying the same economy route with `"fareTier": "Basic"` vs. `"fareTier": "Standard"` excludes Basic Economy fares under `"Standard"`.
  - **Layover Duration:** Querying a 1-stop route populates `maxLayoverMinutes` with the connection duration in integer minutes.
  - **Second-Leg Flight Match:** Filtering by `airline` and `flightNumber` operating as segment 2 of a connecting itinerary returns that itinerary.

### Release v0.1.5: UI fixes
- Brand alignment
    - Header
    - Footer
- copy button not working
- Remove extra adjectives like Armed.
- Cooldown setting?