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
  'air india': 'AI',
  'air china': 'CA',
  'china eastern': 'MU',
  'china eastern airlines': 'MU',
  'china southern': 'CZ',
  'china southern airlines': 'CZ',
  'thai airways': 'TG',
  'vietnam airlines': 'VN',
  'philippine airlines': 'PR',
  'garuda indonesia': 'GA',
  'malaysia airlines': 'MH',
  'el al': 'LY',
  egyptair: 'MS',
  'ethiopian airlines': 'ET',
  'royal air maroc': 'AT',
  'kenya airways': 'KQ',
  'south african airways': 'SA',
  gol: 'G3',
  azul: 'AD',
  volaris: 'Y4',
  'viva aerobus': 'VB',
  'flair airlines': 'F8',
  'air transat': 'TS',
  sunwing: 'WG',
  condor: 'DE',
  eurowings: 'EW',
  vueling: 'VY',
  ryanair: 'FR',
  easyjet: 'U2',
  'wizz air': 'W6',
  norwegian: 'DY',
  'lot polish airlines': 'LO',
  'aegean airlines': 'A3',
  airbaltic: 'BT',
  zipair: 'ZG',
  starlux: 'JX',
  scoot: 'TR',
  'cebu pacific': '5J',
  airasia: 'AK',
  indigo: '6E',
  jetstar: 'JQ',
  'virgin australia': 'VA',
  'fiji airways': 'FJ',
  'air tahiti nui': 'TN',
  'french bee': 'BF',
  corsair: 'SS',
  transavia: 'HV',
  'edelweiss air': 'WK',
  'discover airlines': '4Y',
  'silver airways': '3M',
  'cape air': '9K',
  'contour airlines': 'LF',
  'southern airways express': '9X',
  jsx: 'XE',
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
  AI: 'Air India',
  CA: 'Air China',
  MU: 'China Eastern Airlines',
  CZ: 'China Southern Airlines',
  TG: 'Thai Airways',
  VN: 'Vietnam Airlines',
  PR: 'Philippine Airlines',
  GA: 'Garuda Indonesia',
  MH: 'Malaysia Airlines',
  LY: 'EL AL',
  MS: 'EgyptAir',
  ET: 'Ethiopian Airlines',
  AT: 'Royal Air Maroc',
  KQ: 'Kenya Airways',
  SA: 'South African Airways',
  G3: 'GOL',
  AD: 'Azul',
  Y4: 'Volaris',
  VB: 'Viva Aerobus',
  F8: 'Flair Airlines',
  TS: 'Air Transat',
  WG: 'Sunwing Airlines',
  DE: 'Condor',
  EW: 'Eurowings',
  VY: 'Vueling',
  FR: 'Ryanair',
  U2: 'easyJet',
  W6: 'Wizz Air',
  DY: 'Norwegian',
  LO: 'LOT Polish Airlines',
  A3: 'Aegean Airlines',
  BT: 'airBaltic',
  ZG: 'ZIPAIR',
  JX: 'STARLUX Airlines',
  TR: 'Scoot',
  '5J': 'Cebu Pacific',
  AK: 'AirAsia',
  '6E': 'IndiGo',
  JQ: 'Jetstar',
  VA: 'Virgin Australia',
  FJ: 'Fiji Airways',
  TN: 'Air Tahiti Nui',
  BF: 'French bee',
  SS: 'Corsair',
  HV: 'Transavia',
  WK: 'Edelweiss Air',
  '4Y': 'Discover Airlines',
  '3M': 'Silver Airways',
  '9K': 'Cape Air',
  LF: 'Contour Airlines',
  '9X': 'Southern Airways Express',
  XE: 'JSX',
};

const IATA_CARRIER_CODE_REGEX = /^(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2}$/;
const NON_OPERATING_CARRIER_CODES = new Set(['XX', 'UN']);

export function isValidOperatingCarrierCode(code: string): boolean {
  const upper = code.trim().toUpperCase();
  return (
    IATA_CARRIER_CODE_REGEX.test(upper) &&
    !NON_OPERATING_CARRIER_CODES.has(upper)
  );
}

export function normalizeAirlineCode(rawCodeOrName: string): string {
  const trimmed = rawCodeOrName.trim();
  if (!trimmed) return 'XX';

  const mapped = AIRLINE_NAME_TO_IATA[trimmed.toLowerCase()];
  if (mapped) {
    return mapped;
  }

  const upper = trimmed.toUpperCase();
  if (IATA_CARRIER_CODE_REGEX.test(upper)) {
    return NON_OPERATING_CARRIER_CODES.has(upper) ? 'XX' : upper;
  }

  // Handle combined designators like "UA 1492"
  const prefixMatch = upper.match(
    /^((?=[A-Z0-9]*[A-Z])[A-Z0-9]{2})\s*\d+[A-Z]?$/
  );
  if (prefixMatch?.[1]) {
    return NON_OPERATING_CARRIER_CODES.has(prefixMatch[1])
      ? 'XX'
      : prefixMatch[1];
  }

  return 'XX';
}

export function resolveAirlineCodeFromName(rawName: string): string {
  const trimmed = rawName.trim();
  if (!trimmed) return 'XX';

  const direct = AIRLINE_NAME_TO_IATA[trimmed.toLowerCase()];
  if (direct) {
    return direct;
  }

  // Handle multi-carrier DOM labels such as "Delta, Virgin Atlantic" or "United • Lufthansa"
  const parts = trimmed
    .split(/[,•·/|]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  for (const part of parts) {
    const mapped = AIRLINE_NAME_TO_IATA[part];
    if (mapped) {
      return mapped;
    }
  }

  return 'XX';
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

  if (/^\d+[A-Z]?$/.test(cleaned)) {
    return cleaned;
  }

  if (carrierCode) {
    const normalizedCarrier = normalizeAirlineCode(carrierCode);
    if (cleaned.startsWith(normalizedCarrier) && cleaned.length > 2) {
      return cleaned.slice(normalizedCarrier.length);
    }
  }

  const match = cleaned.match(/^(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2}(\d+[A-Z]?)$/);
  if (match?.[1]) {
    return match[1];
  }

  return cleaned;
}