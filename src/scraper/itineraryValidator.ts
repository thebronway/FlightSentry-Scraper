import type { RouteItinerary, ScrapeRequest } from '@/types';
import { isValidOperatingCarrierCode } from '@/utils/airline';

const AIRPORT_CODE_REGEX = /^[A-Z]{3}$/;
const FLIGHT_DESIGNATOR_REGEX = /^\d+[A-Z]?$/;
const TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?:\s*(?:AM|PM))?$/i;

function normalizeAirportSet(input: string | string[]): Set<string> {
  const list = Array.isArray(input) ? input : [input];
  const codes = new Set<string>();
  for (const entry of list) {
    const upper = entry.trim().toUpperCase();
    if (AIRPORT_CODE_REGEX.test(upper)) {
      codes.add(upper);
    }
  }
  return codes;
}

export function isValidItinerary(
  item: RouteItinerary,
  req: ScrapeRequest
): boolean {
  if (!Number.isFinite(item.price) || item.price <= 0) {
    return false;
  }

  if (!isValidOperatingCarrierCode(item.airline)) {
    return false;
  }

  const allowedOrigins = normalizeAirportSet(req.origin);
  const allowedDestinations = normalizeAirportSet(req.destination);

  if (
    !allowedOrigins.has(item.origin) ||
    !allowedDestinations.has(item.destination)
  ) {
    return false;
  }

  if (!item.departureTime.trim().startsWith(`${req.departureDate} `)) {
    return false;
  }

  if (
    !TIMESTAMP_REGEX.test(item.departureTime.trim()) ||
    !TIMESTAMP_REGEX.test(item.arrivalTime.trim())
  ) {
    return false;
  }

  // Structured payload itineraries include operating legs
  if (item.legs !== undefined) {
    if (!Array.isArray(item.legs) || item.legs.length === 0) {
      return false;
    }

    for (const leg of item.legs) {
      if (
        !AIRPORT_CODE_REGEX.test(leg.origin) ||
        !AIRPORT_CODE_REGEX.test(leg.destination) ||
        !isValidOperatingCarrierCode(leg.airline) ||
        !FLIGHT_DESIGNATOR_REGEX.test(leg.flightNumber.trim())
      ) {
        return false;
      }
    }

    const firstLeg = item.legs[0];
    const lastLeg = item.legs[item.legs.length - 1];
    if (
      firstLeg.origin !== item.origin ||
      lastLeg.destination !== item.destination
    ) {
      return false;
    }

    return true;
  }

  // DOM fallback itineraries lack segment tuples, so require valid duration and non-placeholder clock times
  if (item.durationMinutes <= 0) {
    return false;
  }

  const depClock = item.departureTime.trim().split(/\s+/)[1] ?? '';
  const arrClock = item.arrivalTime.trim().split(/\s+/)[1] ?? '';
  if (depClock === '00:00' && arrClock === '00:00') {
    return false;
  }

  return true;
}

export function filterValidItineraries(
  itineraries: RouteItinerary[],
  req: ScrapeRequest
): RouteItinerary[] {
  return itineraries.filter((item) => isValidItinerary(item, req));
}