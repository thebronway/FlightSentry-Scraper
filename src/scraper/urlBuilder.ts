import type { CabinClass, ScrapeRequest } from '@/types';
import { expandLocationCodes } from '@/utils/coLocations';

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0;
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v & 0x7f);
  return Buffer.from(bytes);
}

function fieldVarint(fieldNumber: number, value: number): Buffer {
  return Buffer.concat([
    encodeVarint((fieldNumber << 3) | 0),
    encodeVarint(value),
  ]);
}

function fieldBytes(fieldNumber: number, payload: Buffer): Buffer {
  return Buffer.concat([
    encodeVarint((fieldNumber << 3) | 2),
    encodeVarint(payload.length),
    payload,
  ]);
}

function fieldString(fieldNumber: number, text: string): Buffer {
  return fieldBytes(fieldNumber, Buffer.from(text, 'utf8'));
}

function encodeCabinEnum(cabin: CabinClass): number {
  switch (cabin) {
    case 'premium_economy':
      return 2;
    case 'business':
      return 3;
    case 'first':
      return 4;
    case 'economy':
    default:
      return 1;
  }
}

export function buildGoogleFlightsUrl(req: ScrapeRequest): string {
  const originAirports = expandLocationCodes(req.origin);
  const destAirports = expandLocationCodes(req.destination);

  const flightSliceParts: Buffer[] = [fieldString(2, req.departureDate)];

  for (const originCode of originAirports) {
    flightSliceParts.push(
      fieldBytes(13, Buffer.concat([fieldVarint(1, 1), fieldString(2, originCode)]))
    );
  }

  for (const destCode of destAirports) {
    flightSliceParts.push(
      fieldBytes(14, Buffer.concat([fieldVarint(1, 1), fieldString(2, destCode)]))
    );
  }

  const rootParts: Buffer[] = [
    fieldVarint(1, 28),
    fieldVarint(2, 2), // One-way trip
    fieldBytes(3, Buffer.concat(flightSliceParts)),
    fieldVarint(8, 1), // 1 adult passenger
    fieldVarint(9, encodeCabinEnum(req.cabinClass)),
  ];

  // Enforce 1 carry-on bag when Standard economy fare tier is requested (excludes Basic Economy)
  if (req.cabinClass === 'economy' && req.fareTier === 'Standard') {
    rootParts.push(fieldBytes(13, fieldVarint(2, 1)));
  }

  rootParts.push(fieldVarint(19, 2));

  const tfsToken = Buffer.concat(rootParts).toString('base64url');
  const url = new URL('https://www.google.com/travel/flights/search');
  url.searchParams.set('tfs', tfsToken);
  url.searchParams.set('hl', 'en');
  url.searchParams.set('curr', req.currency || 'USD');

  return url.toString();
}