const METRO_AREA_AIRPORTS: Record<string, string[]> = {
  WAS: ['DCA', 'IAD', 'BWI'],
  NYC: ['JFK', 'LGA', 'EWR', 'SWF', 'HPN'],
  CHI: ['ORD', 'MDW'],
  LON: ['LHR', 'LGW', 'STN', 'LTN', 'LCY', 'SEN'],
  PAR: ['CDG', 'ORY', 'BVA'],
  TYO: ['HND', 'NRT'],
  OSA: ['KIX', 'ITM', 'UKB'],
  SEL: ['ICN', 'GMP'],
  BJS: ['PEK', 'PKX'],
  SHA: ['PVG', 'SHA'],
  MIL: ['MXP', 'LIN', 'BGY'],
  ROM: ['FCO', 'CIA'],
  STO: ['ARN', 'BMA', 'NYO', 'VST'],
  MOW: ['SVO', 'DME', 'VKO', 'ZIA'],
  YTO: ['YYZ', 'YTZ', 'YHM'],
  YMQ: ['YUL', 'YMX'],
  SFO: ['SFO'],
  BAY: ['SFO', 'OAK', 'SJC'],
  LAX: ['LAX'],
  QLA: ['LAX', 'BUR', 'SNA', 'ONT', 'LGB'],
  MIA: ['MIA'],
  QMI: ['MIA', 'FLL', 'PBI'],
  DFW: ['DFW'],
  QDF: ['DFW', 'DAL'],
  HOU: ['IAH', 'HOU'],
  BHZ: ['CNF', 'PLU'],
  SAO: ['GRU', 'CGH', 'VCP'],
  RIO: ['GIG', 'SDU'],
  BUE: ['EZE', 'AEP'],
};

export function expandLocationCodes(locationInput: string): string[] {
  const parts = locationInput
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  const expanded: string[] = [];
  for (const code of parts) {
    const metroList = METRO_AREA_AIRPORTS[code];
    if (metroList) {
      for (const airport of metroList) {
        if (!expanded.includes(airport)) {
          expanded.push(airport);
        }
      }
    } else if (!expanded.includes(code)) {
      expanded.push(code);
    }
  }

  return expanded;
}

export function formatLocationDisplay(locationInput: string): string {
  const parts = locationInput
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return parts.join(',');
}