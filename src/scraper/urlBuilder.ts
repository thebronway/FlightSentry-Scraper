import type { CabinClass, ScrapeRequest } from '@/types';
import { expandLocationCodes } from '@/utils/coLocations';

function formatCabinQueryToken(cabin: CabinClass): string {
  switch (cabin) {
    case 'premium_economy':
      return 'premium economy';
    case 'business':
      return 'business class';
    case 'first':
      return 'first class';
    case 'economy':
    default:
      return '';
  }
}

function formatStopsQueryToken(maxStops?: number): string {
  if (maxStops === undefined) return '';
  if (maxStops === 0) return 'nonstop';
  if (maxStops === 1) return '1 stop or fewer';
  if (maxStops === 2) return '2 stops or fewer';
  return '';
}

export function buildGoogleFlightsUrl(req: ScrapeRequest): string {
  const originAirports = expandLocationCodes(req.origin);
  const destAirports = expandLocationCodes(req.destination);

  const originSegment = originAirports.join(' or ');
  const destSegment = destAirports.join(' or ');

  const tokens: string[] = [
    `Flights to ${destSegment} from ${originSegment} on ${req.departureDate} oneway`,
  ];

  const cabinToken = formatCabinQueryToken(req.cabinClass);
  if (cabinToken) {
    tokens.push(cabinToken);
  }

  const stopsToken = formatStopsQueryToken(req.maxStops);
  if (stopsToken) {
    tokens.push(stopsToken);
  }

  if (req.airline) {
    tokens.push(req.airline);
  } else if (req.includedAirlines && req.includedAirlines.length === 1) {
    tokens.push(req.includedAirlines[0]);
  }

  // Request carry-on bag inclusion when Standard economy fare tier is requested
  if (req.cabinClass === 'economy' && req.fareTier === 'Standard') {
    tokens.push('carry on bag');
  }

  const url = new URL('https://www.google.com/travel/flights');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('curr', req.currency || 'USD');
  url.searchParams.set('q', tokens.join(' '));

  return url.toString();
}