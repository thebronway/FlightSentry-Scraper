import type { Page } from 'playwright';
import type { RouteItinerary, RouteSegment, ScrapeRequest } from '@/types';
import {
  cleanFlightNumber,
  normalizeAirlineCode,
  resolveAirlineName,
} from '@/utils/airline';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hrs = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function parseDurationTextToMinutes(text: string): number {
  const hrMatch = text.match(/(\d+)\s*h/i);
  const minMatch = text.match(/(\d+)\s*m/i);
  const hours = hrMatch ? Number(hrMatch[1]) : 0;
  const mins = minMatch ? Number(minMatch[1]) : 0;
  return hours * 60 + mins;
}

function extractIsoDateFromTuple(
  dateTuple: unknown,
  fallbackDate: string
): { date: string; explicit: boolean } {
  if (
    Array.isArray(dateTuple) &&
    dateTuple.length >= 3 &&
    typeof dateTuple[0] === 'number' &&
    typeof dateTuple[1] === 'number' &&
    typeof dateTuple[2] === 'number'
  ) {
    return {
      date: `${dateTuple[0]}-${pad2(dateTuple[1])}-${pad2(dateTuple[2])}`,
      explicit: true,
    };
  }
  return { date: fallbackDate, explicit: false };
}

function extractClockTuple(timeTuple: unknown): { hour: number; minute: number } {
  let hour = 0;
  let minute = 0;
  if (Array.isArray(timeTuple)) {
    if (typeof timeTuple[0] === 'number') hour = timeTuple[0];
    if (typeof timeTuple[1] === 'number') minute = timeTuple[1];
  }
  return { hour, minute };
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return isoDate;
  }
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function formatDateTuple(
  dateTuple: unknown,
  timeTuple: unknown,
  fallbackDate: string
): string {
  const { date } = extractIsoDateFromTuple(dateTuple, fallbackDate);
  const { hour, minute } = extractClockTuple(timeTuple);
  return `${date} ${pad2(hour)}:${pad2(minute)}`;
}

function parseTimestampToUtcMs(timestamp: string): number | null {
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const ms = Date.UTC(year, month - 1, day, hour, minute);
  return Number.isFinite(ms) ? ms : null;
}

function extractRouteSegments(
  rawLegs: unknown[],
  defaultAirline: string,
  fallbackOrigin: string,
  fallbackDestination: string,
  initialDate: string
): RouteSegment[] {
  const segments: RouteSegment[] = [];
  let rollingDate = initialDate;

  for (let i = 0; i < rawLegs.length; i++) {
    const leg = rawLegs[i];
    if (!Array.isArray(leg)) continue;

    const prevSeg = segments[segments.length - 1];
    const segOrigin =
      typeof leg[3] === 'string' && /^[A-Z]{3}$/.test(leg[3])
        ? leg[3]
        : prevSeg?.destination ?? fallbackOrigin;

    const segDestination =
      typeof leg[6] === 'string' && /^[A-Z]{3}$/.test(leg[6])
        ? leg[6]
        : i === rawLegs.length - 1
          ? fallbackDestination
          : '';

    let rawSegAirline = defaultAirline;
    let rawSegFlightNum = '';
    if (Array.isArray(leg[22])) {
      const flightMeta = leg[22];
      if (typeof flightMeta[0] === 'string' && flightMeta[0].trim()) {
        rawSegAirline = flightMeta[0];
      }
      if (
        typeof flightMeta[1] === 'string' ||
        typeof flightMeta[1] === 'number'
      ) {
        rawSegFlightNum = String(flightMeta[1]);
      }
    }

    const segAirline = normalizeAirlineCode(rawSegAirline || defaultAirline || 'XX');
    const segFlightNumber = cleanFlightNumber(rawSegFlightNum, segAirline);

    const depDateInfo = extractIsoDateFromTuple(leg[20], rollingDate);
    const depClock = extractClockTuple(leg[8]);
    if (depDateInfo.explicit) {
      rollingDate = depDateInfo.date;
    } else if (prevSeg) {
      const prevArrClockPart = prevSeg.arrivalTime.split(' ')[1];
      if (prevArrClockPart) {
        const [prevH, prevM] = prevArrClockPart.split(':').map(Number);
        if (
          Number.isFinite(prevH) &&
          Number.isFinite(prevM) &&
          depClock.hour * 60 + depClock.minute < prevH * 60 + prevM
        ) {
          rollingDate = addDaysToIsoDate(rollingDate, 1);
        }
      }
    }
    const depDate = rollingDate;
    const departureTime = `${depDate} ${pad2(depClock.hour)}:${pad2(depClock.minute)}`;

    const segDurationMinutes =
      typeof leg[11] === 'number' && leg[11] > 0 ? Math.round(leg[11]) : 0;

    const arrDateInfo = extractIsoDateFromTuple(leg[21], depDate);
    const arrClock = extractClockTuple(leg[10]);
    if (arrDateInfo.explicit) {
      rollingDate = arrDateInfo.date;
    } else {
      const depMinutesOfDay = depClock.hour * 60 + depClock.minute;
      const arrMinutesOfDay = arrClock.hour * 60 + arrClock.minute;
      if (segDurationMinutes > 0) {
        const dayOffset = Math.floor((depMinutesOfDay + segDurationMinutes) / 1440);
        if (dayOffset > 0) {
          rollingDate = addDaysToIsoDate(depDate, dayOffset);
        } else if (arrMinutesOfDay < depMinutesOfDay) {
          rollingDate = addDaysToIsoDate(depDate, 1);
        }
      } else if (arrMinutesOfDay < depMinutesOfDay) {
        rollingDate = addDaysToIsoDate(depDate, 1);
      }
    }
    const arrivalTime = `${rollingDate} ${pad2(arrClock.hour)}:${pad2(arrClock.minute)}`;

    segments.push({
      airline: segAirline,
      flightNumber: segFlightNumber,
      origin: segOrigin,
      destination: segDestination,
      departureTime,
      arrivalTime,
      durationMinutes: segDurationMinutes,
    });
  }

  return segments;
}

function calculateMaxLayoverMinutes(
  segments: RouteSegment[],
  stops: number,
  totalDurationMinutes: number
): number | null {
  if (stops === 0 || segments.length < 2) {
    return null;
  }

  let maxGap: number | null = null;
  for (let i = 0; i < segments.length - 1; i++) {
    const prevArrMs = parseTimestampToUtcMs(segments[i].arrivalTime);
    const nextDepMs = parseTimestampToUtcMs(segments[i + 1].departureTime);
    if (prevArrMs !== null && nextDepMs !== null) {
      const gapMinutes = Math.round((nextDepMs - prevArrMs) / 60_000);
      if (gapMinutes >= 0 && (maxGap === null || gapMinutes > maxGap)) {
        maxGap = gapMinutes;
      }
    }
  }

  if (maxGap !== null) {
    return maxGap;
  }

  if (stops === 1 && segments.length === 2 && totalDurationMinutes > 0) {
    const flyingMinutes = segments[0].durationMinutes + segments[1].durationMinutes;
    if (flyingMinutes > 0 && totalDurationMinutes >= flyingMinutes) {
      return totalDurationMinutes - flyingMinutes;
    }
  }

  return null;
}

function extractBalancedJson(source: string, startIndex: number): string | null {
  const openChar = source[startIndex];
  const closeChar = openChar === '[' ? ']' : openChar === '{' ? '}' : null;
  if (!closeChar) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

export function extractDs1JsonFromHtml(html: string): string | null {
  const markerRegex = /AF_initDataCallback\s*\(\s*\{[\s\S]*?key\s*:\s*['"]ds:1['"][\s\S]*?data\s*:\s*/g;
  const match = markerRegex.exec(html);
  if (!match) return null;

  const dataStart = match.index + match[0].length;
  for (let i = dataStart; i < Math.min(html.length, dataStart + 64); i++) {
    const ch = html[i];
    if (ch === '[' || ch === '{') {
      return extractBalancedJson(html, i);
    }
  }
  return null;
}

function tryParseFlightGroupArray(
  node: unknown,
  fallbackDate: string,
  results: RouteItinerary[]
): void {
  if (!Array.isArray(node)) return;

  // Google Flights itinerary tuple shape:
  // [ [airlineCodes, airlineNames, legsArray, originAirport, depDateTuple, depTimeTuple, destAirport, arrDateTuple, arrTimeTuple, durationMins, ...], [ [null, price], ... ] ]
  if (
    node.length >= 2 &&
    Array.isArray(node[0]) &&
    node[0].length >= 10 &&
    Array.isArray(node[1])
  ) {
    const summary = node[0];
    const priceBlock = node[1];

    const legs = Array.isArray(summary[2]) ? summary[2] : [];
    const firstLeg = Array.isArray(legs[0]) ? legs[0] : null;
    const lastLeg =
      legs.length > 0 && Array.isArray(legs[legs.length - 1])
        ? legs[legs.length - 1]
        : firstLeg;

    const origin =
      typeof summary[3] === 'string' && /^[A-Z]{3}$/.test(summary[3])
        ? summary[3]
        : typeof firstLeg?.[3] === 'string'
          ? firstLeg[3]
          : null;

    const destination =
      typeof summary[6] === 'string' && /^[A-Z]{3}$/.test(summary[6])
        ? summary[6]
        : typeof lastLeg?.[6] === 'string'
          ? lastLeg[6]
          : null;

    // Price extraction from priceBlock
    let price: number | null = null;
    if (Array.isArray(priceBlock[0]) && typeof priceBlock[0][1] === 'number') {
      price = priceBlock[0][1];
    } else if (typeof priceBlock[1] === 'number') {
      price = priceBlock[1];
    }

    if (origin && destination && price !== null && price > 0) {
      const rawCarrierNames = Array.isArray(summary[1]) ? summary[1] : [];

      let rawAirline =
        typeof summary[0] === 'string'
          ? summary[0]
          : Array.isArray(summary[0]) && typeof summary[0][0] === 'string'
            ? summary[0][0]
            : '';
      let rawAirlineName =
        typeof rawCarrierNames[0] === 'string' ? rawCarrierNames[0] : null;
      let rawFlightNum = '';

      // Leg-level carrier + flight number tuple is at firstLeg[22] = [carrier, flightNum, null, carrierName]
      if (firstLeg && Array.isArray(firstLeg[22])) {
        const flightMeta = firstLeg[22];
        if (typeof flightMeta[0] === 'string') rawAirline = flightMeta[0];
        if (typeof flightMeta[1] === 'string' || typeof flightMeta[1] === 'number') {
          rawFlightNum = String(flightMeta[1]);
        }
        if (typeof flightMeta[3] === 'string') rawAirlineName = flightMeta[3];
      }

      const airline = normalizeAirlineCode(rawAirline || rawAirlineName || 'XX');
      const airlineName = resolveAirlineName(airline, rawAirlineName);
      const flightNumber = cleanFlightNumber(rawFlightNum, airline);

      const departureTime = formatDateTuple(
        summary[4],
        summary[5],
        fallbackDate
      );
      const arrivalTime = formatDateTuple(
        summary[7],
        summary[8],
        fallbackDate
      );

      const durationMinutes =
        typeof summary[9] === 'number' && summary[9] > 0 ? summary[9] : 0;

      const summaryStartDate = extractIsoDateFromTuple(
        summary[4],
        fallbackDate
      ).date;
      const routeSegments = extractRouteSegments(
        legs,
        airline,
        origin,
        destination,
        summaryStartDate
      );

      const stops = Math.max(0, legs.length > 0 ? legs.length - 1 : 0);
      const layoverAirports: string[] = [];
      if (legs.length > 1) {
        for (let i = 0; i < legs.length - 1; i++) {
          const leg = legs[i];
          if (Array.isArray(leg) && typeof leg[6] === 'string') {
            layoverAirports.push(leg[6]);
          }
        }
      }

      const maxLayoverMinutes = calculateMaxLayoverMinutes(
        routeSegments,
        stops,
        durationMinutes
      );

      results.push({
        airline,
        airlineName,
        flightNumber,
        origin,
        destination,
        price,
        departureTime,
        arrivalTime,
        duration: formatDuration(durationMinutes),
        durationMinutes,
        stops,
        isNonstop: stops === 0,
        layoverAirports,
        maxLayoverMinutes,
        ...(routeSegments.length > 0 ? { legs: routeSegments } : {}),
      });
      return;
    }
  }

  for (const child of node) {
    if (Array.isArray(child)) {
      tryParseFlightGroupArray(child, fallbackDate, results);
    }
  }
}

export function parseStructuredPayload(
  rawPayloads: string[],
  fallbackDate: string
): RouteItinerary[] {
  const parsedItineraries: RouteItinerary[] = [];

  for (const payload of rawPayloads) {
    const cleaned = payload.replace(/^\)\]\}'\s*\n?/, '').trim();
    if (!cleaned) continue;

    try {
      const json = JSON.parse(cleaned);
      tryParseFlightGroupArray(json, fallbackDate, parsedItineraries);
    } catch {
      // Handle Google batchexecute multi-line envelopes
      const lines = cleaned.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith('[')) continue;
        try {
          const outer = JSON.parse(trimmedLine);
          if (Array.isArray(outer)) {
            for (const entry of outer) {
              if (Array.isArray(entry) && typeof entry[2] === 'string') {
                const innerJson = JSON.parse(entry[2]);
                tryParseFlightGroupArray(
                  innerJson,
                  fallbackDate,
                  parsedItineraries
                );
              }
            }
          }
        } catch {
          // Ignore non-JSON chunk lines
        }
      }
    }
  }

  return deduplicateItineraries(parsedItineraries);
}

export async function parseItinerariesFromDom(
  page: Page,
  req: ScrapeRequest
): Promise<RouteItinerary[]> {
  const domCards = await page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll('ul.Rk10dc > li, li.pIav2d')
    );

    return items
      .map((el) => {
        const text = (el as HTMLElement).innerText || '';
        const aria = el.getAttribute('aria-label') || '';
        return { text, aria };
      })
      .filter((entry) => /\$\d+|€\d+|£\d+|\d+\s*(USD|EUR|GBP|CAD|AUD)/i.test(entry.text));
  });

  const results: RouteItinerary[] = [];

  for (const card of domCards) {
    const combined = `${card.aria}\n${card.text}`;
    const priceMatch = combined.match(/(?:\$|€|£|USD|EUR|GBP|CAD|AUD)\s*([\d,]+)/i);
    if (!priceMatch?.[1]) continue;

    const price = Number(priceMatch[1].replace(/,/g, ''));
    if (!Number.isFinite(price) || price <= 0) continue;

    const airportPairMatch = combined.match(/\b([A-Z]{3})\s*[–—-]\s*([A-Z]{3})\b/);
    const fallbackOrigin = Array.isArray(req.origin) ? req.origin[0] : req.origin;
    const fallbackDestination = Array.isArray(req.destination)
      ? req.destination[0]
      : req.destination;
    const origin = airportPairMatch?.[1] ?? fallbackOrigin;
    const destination = airportPairMatch?.[2] ?? fallbackDestination;

    const durationMatch = combined.match(/\b(\d+\s*hr?\s*(?:\d+\s*m(?:in)?)?)\b/i);
    const durationText = durationMatch?.[1] ?? '0m';
    const durationMinutes = parseDurationTextToMinutes(durationText);

    let stops = 0;
    if (/nonstop/i.test(combined)) {
      stops = 0;
    } else {
      const stopMatch = combined.match(/\b(\d+)\s+stops?\b/i);
      if (stopMatch?.[1]) {
        stops = Number(stopMatch[1]);
      }
    }

    const lines = card.text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const candidateAirline =
      lines.find(
        (l) =>
          !/^\d/.test(l) &&
          !/\$|€|£/.test(l) &&
          !/nonstop|stop|hr|min|kg|co2|emissions/i.test(l) &&
          l.length >= 2 &&
          l.length <= 40
      ) ?? 'Unknown';

    const airline = normalizeAirlineCode(candidateAirline);
    const airlineName = resolveAirlineName(airline, candidateAirline);

    const timeMatches = combined.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM)?)\b/gi) ?? [];
    const depTime = timeMatches[0] ?? '00:00';
    const arrTime = timeMatches[1] ?? '00:00';

    results.push({
      airline,
      airlineName,
      flightNumber: '',
      origin,
      destination,
      price,
      departureTime: `${req.departureDate} ${depTime}`,
      arrivalTime: `${req.departureDate} ${arrTime}`,
      duration: durationMinutes > 0 ? formatDuration(durationMinutes) : durationText,
      durationMinutes,
      stops,
      isNonstop: stops === 0,
      layoverAirports: [],
      maxLayoverMinutes: null,
    });
  }

  return deduplicateItineraries(results);
}

function deduplicateItineraries(items: RouteItinerary[]): RouteItinerary[] {
  const seen = new Set<string>();
  const unique: RouteItinerary[] = [];

  for (const item of items) {
    const key = [
      item.airline,
      item.flightNumber,
      item.origin,
      item.destination,
      item.departureTime,
      item.arrivalTime,
      item.price,
    ].join('|');

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

export function applyScrapeFilters(
  itineraries: RouteItinerary[],
  req: ScrapeRequest
): RouteItinerary[] {
  return itineraries
    .filter((item) => {
      if (req.maxStops !== undefined && item.stops > req.maxStops) {
        return false;
      }

      if (req.includedAirlines && req.includedAirlines.length > 0) {
        if (!req.includedAirlines.includes(item.airline)) {
          return false;
        }
      }

      if (req.excludedAirlines && req.excludedAirlines.length > 0) {
        if (req.excludedAirlines.includes(item.airline)) {
          return false;
        }
      }

      if (req.flightNumber) {
        const trimmedFlight = req.flightNumber.trim().toUpperCase().replace(/\s+/g, '');
        const embeddedCarrierMatch = trimmedFlight.match(
          /^(?=[A-Z0-9]*[A-Z])([A-Z0-9]{2})\d+[A-Z]?$/
        );
        const targetCarrier = req.airline ?? embeddedCarrierMatch?.[1];
        const targetNum = cleanFlightNumber(req.flightNumber, targetCarrier);

        if (targetNum) {
          if (item.legs && item.legs.length > 0) {
            const matchesAnyLeg = item.legs.some(
              (leg) =>
                leg.flightNumber === targetNum &&
                (!targetCarrier || leg.airline === targetCarrier)
            );
            if (!matchesAnyLeg) {
              return false;
            }
          } else {
            if (targetCarrier && item.airline !== targetCarrier) {
              return false;
            }
            if (!item.flightNumber || item.flightNumber !== targetNum) {
              return false;
            }
          }
        }
      } else if (req.airline && item.airline !== req.airline) {
        return false;
      }

      return true;
    })
    .sort((a, b) => a.price - b.price);
}