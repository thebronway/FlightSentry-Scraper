import type { Page } from 'playwright';
import type { RouteItinerary, ScrapeRequest } from '@/types';
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

function formatDateTuple(
  dateTuple: unknown,
  timeTuple: unknown,
  fallbackDate: string
): string {
  let datePart = fallbackDate;
  if (
    Array.isArray(dateTuple) &&
    dateTuple.length >= 3 &&
    typeof dateTuple[0] === 'number' &&
    typeof dateTuple[1] === 'number' &&
    typeof dateTuple[2] === 'number'
  ) {
    datePart = `${dateTuple[0]}-${pad2(dateTuple[1])}-${pad2(dateTuple[2])}`;
  }

  let hour = 0;
  let minute = 0;
  if (Array.isArray(timeTuple)) {
    if (typeof timeTuple[0] === 'number') hour = timeTuple[0];
    if (typeof timeTuple[1] === 'number') minute = timeTuple[1];
  }

  return `${datePart} ${pad2(hour)}:${pad2(minute)}`;
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
      const rawCarriers = Array.isArray(summary[0]) ? summary[0] : [];
      const rawCarrierNames = Array.isArray(summary[1]) ? summary[1] : [];

      let rawAirline =
        typeof rawCarriers[0] === 'string' ? rawCarriers[0] : '';
      let rawAirlineName =
        typeof rawCarrierNames[0] === 'string' ? rawCarrierNames[0] : null;
      let rawFlightNum = '';

      // Leg-level carrier + flight number tuple is typically at firstLeg[22] = [carrier, flightNum, null, carrierName]
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
      document.querySelectorAll('ul.Rk10dc > li, li.pIav2d, [role="listitem"]')
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
    const origin = airportPairMatch?.[1] ?? req.origin.split(',')[0] ?? req.origin;
    const destination =
      airportPairMatch?.[2] ?? req.destination.split(',')[0] ?? req.destination;

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

      if (req.airline && item.airline !== req.airline) {
        return false;
      }

      if (req.flightNumber) {
        const targetNum = cleanFlightNumber(req.flightNumber, req.airline);
        if (targetNum && item.flightNumber && item.flightNumber !== targetNum) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => a.price - b.price);
}