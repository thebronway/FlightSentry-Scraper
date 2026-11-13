const AIRLINE_NAME_TO_IATA: Record<string, string> = {
  'american airlines': 'AA',
  american: 'AA',
  'delta air lines': 'DL',
  delta: 'DL',
  'united airlines': 'UA',
  united: 'UA',
  'southwest airlines': 'WN',
  southwest: 'WN',
  'alaska airlines': 'AS',
  alaska: 'AS',
  'jetblue airways': 'B6',
  jetblue: 'B6',
  'spirit airlines': 'NK',
  spirit: 'NK',
  'frontier airlines': 'F9',
  frontier: 'F9',
  'hawaiian airlines': 'HA',
  hawaiian: 'HA',
  'allegiant air': 'G4',
  allegiant: 'G4',
  'sun country airlines': 'SY',
  'air canada': 'AC',
  westjet: 'WS',
  'british airways': 'BA',
  lufthansa: 'LH',
  'air france': 'AF',
  klm: 'KL',
  'virgin atlantic': 'VS',
  iberia: 'IB',
  'aer lingus': 'EI',
  swiss: 'LX',
  'austrian airlines': 'OS',
  'brussels airlines': 'SN',
  'scandinavian airlines': 'SK',
  sas: 'SK',
  finnair: 'AY',
  'tap air portugal': 'TP',
  ita: 'AZ',
  'ita airways': 'AZ',
  'turkish airlines': 'TK',
  emirates: 'EK',
  'qatar airways': 'QR',
  'etihad airways': 'EY',
  'singapore airlines': 'SQ',
  'cathay pacific': 'CX',
  'japan airlines': 'JL',
  ana: 'NH',
  'all nippon airways': 'NH',
  'korean air': 'KE',
  'asiana airlines': 'OZ',
  'eva air': 'BR',
  'china airlines': 'CI',
  qantas: 'QF',
  'air new zealand': 'NZ',
  aeromexico: 'AM',
  'copa airlines': 'CM',
  avianca: 'AV',
  latam: 'LA',
  'latam airlines': 'LA',
  icelandair: 'FI',
  'play airlines': 'OG',
  norse: 'N0',
  'norse atlantic airways': 'N0',
  porter: 'PD',
  'porter airlines': 'PD',
  breeze: 'MX',
  'breeze airways': 'MX',
  avelo: 'XP',
  'avelo airlines': 'XP',
};

const IATA_TO_AIRLINE_NAME: Record<string, string> = {
  AA: 'American Airlines',
  DL: 'Delta Air Lines',
  UA: 'United Airlines',
  WN: 'Southwest Airlines',
  AS: 'Alaska Airlines',
  B6: 'JetBlue Airways',
  NK: 'Spirit Airlines',
  F9: 'Frontier Airlines',
  HA: 'Hawaiian Airlines',
  G4: 'Allegiant Air',
  SY: 'Sun Country Airlines',
  AC: 'Air Canada',
  WS: 'WestJet',
  BA: 'British Airways',
  LH: 'Lufthansa',
  AF: 'Air France',
  KL: 'KLM',
  VS: 'Virgin Atlantic',
  IB: 'Iberia',
  EI: 'Aer Lingus',
  LX: 'SWISS',
  OS: 'Austrian Airlines',
  SN: 'Brussels Airlines',
  SK: 'SAS',
  AY: 'Finnair',
  TP: 'TAP Air Portugal',
  AZ: 'ITA Airways',
  TK: 'Turkish Airlines',
  EK: 'Emirates',
  QR: 'Qatar Airways',
  EY: 'Etihad Airways',
  SQ: 'Singapore Airlines',
  CX: 'Cathay Pacific',
  JL: 'Japan Airlines',
  NH: 'All Nippon Airways',
  KE: 'Korean Air',
  OZ: 'Asiana Airlines',
  BR: 'EVA Air',
  CI: 'China Airlines',
  QF: 'Qantas',
  NZ: 'Air New Zealand',
  AM: 'Aeromexico',
  CM: 'Copa Airlines',
  AV: 'Avianca',
  LA: 'LATAM Airlines',
  FI: 'Icelandair',
  OG: 'PLAY',
  N0: 'Norse Atlantic Airways',
  PD: 'Porter Airlines',
  MX: 'Breeze Airways',
  XP: 'Avelo Airlines',
};

export function normalizeAirlineCode(rawCodeOrName: string): string {
  const trimmed = rawCodeOrName.trim();
  if (!trimmed) return 'XX';

  const upper = trimmed.toUpperCase();
  if (/^[A-Z0-9]{2}$/.test(upper)) {
    return upper;
  }

  // Handle combined strings like "UA 1492" or "United Airlines"
  const prefixMatch = upper.match(/^([A-Z0-9]{2})\s*\d+$/);
  if (prefixMatch?.[1]) {
    return prefixMatch[1];
  }

  const mapped = AIRLINE_NAME_TO_IATA[trimmed.toLowerCase()];
  if (mapped) {
    return mapped;
  }

  return upper.slice(0, 2);
}

export function resolveAirlineName(
  iataCode: string,
  fallbackName?: string | null
): string {
  if (fallbackName && fallbackName.trim().length > 1) {
    return fallbackName.trim();
  }
  const normalized = normalizeAirlineCode(iataCode);
  return IATA_TO_AIRLINE_NAME[normalized] ?? normalized;
}

export function cleanFlightNumber(
  rawFlightNumber: string,
  carrierCode?: string
): string {
  const cleaned = rawFlightNumber.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) return '';

  if (carrierCode) {
    const normalizedCarrier = normalizeAirlineCode(carrierCode);
    if (cleaned.startsWith(normalizedCarrier) && cleaned.length > 2) {
      return cleaned.slice(normalizedCarrier.length);
    }
  }

  const match = cleaned.match(/^[A-Z0-9]{2}(\d+[A-Z]?)$/);
  if (match?.[1]) {
    return match[1];
  }

  return cleaned;
}