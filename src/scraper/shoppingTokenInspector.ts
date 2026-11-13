const MAX_PROTO_TOKEN_LENGTH = 8192;
const MIN_PROTO_TOKEN_LENGTH = 32;
const BASE64URL_TOKEN_REGEX = /^[A-Za-z0-9_-]{32,8192}$/;

interface ProtoFieldEntry {
  wireType: number;
  varint?: number;
  bytes?: Buffer;
}

type ProtoFieldMap = Map<number, ProtoFieldEntry[]>;

export interface ShoppingPayloadInspection {
  hasValidQueryToken: boolean;
  hasExplicitExclusion: boolean;
  isBaselineUnfilteredEconomy: boolean;
  filterSignature: string | null;
}

function readVarint(
  buf: Buffer,
  startPos: number
): { value: number; nextPos: number } | null {
  let value = 0;
  let multiplier = 1;
  let pos = startPos;
  let bytesRead = 0;

  while (pos < buf.length) {
    const byte = buf[pos];
    pos += 1;
    bytesRead += 1;
    if (bytesRead > 10) {
      return null;
    }

    value += (byte & 0x7f) * multiplier;
    if (!Number.isSafeInteger(value)) {
      return null;
    }

    if ((byte & 0x80) === 0) {
      return { value, nextPos: pos };
    }
    multiplier *= 128;
  }

  return null;
}

function parseProtoMessage(buf: Buffer): ProtoFieldMap | null {
  const fields: ProtoFieldMap = new Map();
  let pos = 0;

  while (pos < buf.length) {
    const keyInfo = readVarint(buf, pos);
    if (!keyInfo) return null;
    pos = keyInfo.nextPos;

    const fieldNumber = Math.floor(keyInfo.value / 8);
    const wireType = keyInfo.value % 8;
    if (fieldNumber <= 0) return null;

    if (wireType === 0) {
      const valInfo = readVarint(buf, pos);
      if (!valInfo) return null;
      pos = valInfo.nextPos;
      const existing = fields.get(fieldNumber) ?? [];
      existing.push({ wireType, varint: valInfo.value });
      fields.set(fieldNumber, existing);
    } else if (wireType === 1) {
      if (pos + 8 > buf.length) return null;
      const bytes = buf.subarray(pos, pos + 8);
      pos += 8;
      const existing = fields.get(fieldNumber) ?? [];
      existing.push({ wireType, bytes });
      fields.set(fieldNumber, existing);
    } else if (wireType === 2) {
      const lenInfo = readVarint(buf, pos);
      if (!lenInfo) return null;
      pos = lenInfo.nextPos;
      if (lenInfo.value < 0 || pos + lenInfo.value > buf.length) return null;
      const bytes = buf.subarray(pos, pos + lenInfo.value);
      pos += lenInfo.value;
      const existing = fields.get(fieldNumber) ?? [];
      existing.push({ wireType, bytes });
      fields.set(fieldNumber, existing);
    } else if (wireType === 5) {
      if (pos + 4 > buf.length) return null;
      const bytes = buf.subarray(pos, pos + 4);
      pos += 4;
      const existing = fields.get(fieldNumber) ?? [];
      existing.push({ wireType, bytes });
      fields.set(fieldNumber, existing);
    } else {
      return null;
    }
  }

  return fields;
}

function getFirstVarint(map: ProtoFieldMap, fieldNumber: number): number | null {
  const entries = map.get(fieldNumber);
  if (!entries) return null;
  for (const entry of entries) {
    if (entry.wireType === 0 && typeof entry.varint === 'number') {
      return entry.varint;
    }
  }
  return null;
}

function getFirstBytes(map: ProtoFieldMap, fieldNumber: number): Buffer | null {
  const entries = map.get(fieldNumber);
  if (!entries) return null;
  for (const entry of entries) {
    if (entry.wireType === 2 && entry.bytes) {
      return entry.bytes;
    }
  }
  return null;
}

function inspectDecodedQueryToken(token: string): ShoppingPayloadInspection | null {
  if (
    token.length < MIN_PROTO_TOKEN_LENGTH ||
    token.length > MAX_PROTO_TOKEN_LENGTH ||
    !BASE64URL_TOKEN_REGEX.test(token)
  ) {
    return null;
  }

  let rawBuffer: Buffer;
  try {
    rawBuffer = Buffer.from(token, 'base64url');
  } catch {
    return null;
  }

  if (rawBuffer.length < 16) return null;

  const rootFields = parseProtoMessage(rawBuffer);
  if (!rootFields) return null;

  // Confirm this protobuf is a Google Flights shopping query state token
  const currencyBytes = getFirstBytes(rootFields, 5);
  const f12Bytes = getFirstBytes(rootFields, 12);
  const f6Bytes = getFirstBytes(rootFields, 6);
  const hasCurrency =
    currencyBytes !== null &&
    currencyBytes.length === 3 &&
    /^[A-Z]{3}$/.test(currencyBytes.toString('utf8'));

  if (!hasCurrency && !f12Bytes && !f6Bytes) {
    return null;
  }

  const rootExclusion = getFirstVarint(rootFields, 25) === 1;
  let f12Exclusion = false;
  let isBaselineUnfilteredEconomy = false;
  let filterSubHex = 'none';

  if (f12Bytes) {
    const f12Fields = parseProtoMessage(f12Bytes);
    if (f12Fields) {
      if (getFirstVarint(f12Fields, 25) === 1) {
        f12Exclusion = true;
      }

      const f12Sub3Bytes = getFirstBytes(f12Fields, 3);
      if (f12Sub3Bytes) {
        filterSubHex = f12Sub3Bytes.toString('hex');
        const f12Sub3Fields = parseProtoMessage(f12Sub3Bytes);
        if (f12Sub3Fields) {
          if (
            getFirstVarint(f12Sub3Fields, 18) === 1 ||
            getFirstVarint(f12Sub3Fields, 25) === 1
          ) {
            f12Exclusion = true;
          }

          // Unfiltered economy baseline in GetShoppingResults has cabin=1 (field 2)
          // and only baseline keys {1, 2, 17} with no Basic Economy exclusion field.
          const cabinVal = getFirstVarint(f12Sub3Fields, 2);
          const keys = Array.from(f12Sub3Fields.keys());
          const onlyBaselineKeys =
            keys.length > 0 &&
            keys.every((k) => k === 1 || k === 2 || k === 17);

          if (
            !rootExclusion &&
            !f12Exclusion &&
            (cabinVal === null || cabinVal === 1) &&
            onlyBaselineKeys
          ) {
            isBaselineUnfilteredEconomy = true;
          }
        }
      }
    }
  }

  const hasExplicitExclusion = rootExclusion || f12Exclusion;
  const filterSignature = `r25:${rootExclusion ? 1 : 0}|f12_3:${filterSubHex}`;

  return {
    hasValidQueryToken: true,
    hasExplicitExclusion,
    isBaselineUnfilteredEconomy,
    filterSignature,
  };
}

function collectTokenCandidates(
  node: unknown,
  out: string[],
  depth = 0,
  state = { visited: 0 }
): void {
  if (depth > 6 || state.visited > 500 || out.length >= 12) return;
  state.visited += 1;

  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (
      trimmed.length >= MIN_PROTO_TOKEN_LENGTH &&
      trimmed.length <= MAX_PROTO_TOKEN_LENGTH &&
      BASE64URL_TOKEN_REGEX.test(trimmed)
    ) {
      out.push(trimmed);
    }
    return;
  }

  if (Array.isArray(node)) {
    // Prioritize trailing elements first since Google places the query state token at the end
    for (let i = node.length - 1; i >= 0; i--) {
      collectTokenCandidates(node[i], out, depth + 1, state);
      if (out.length >= 12 || state.visited > 500) break;
    }
  }
}

function extractCandidatesFromRawText(rawText: string): string[] {
  const candidates: string[] = [];
  const cleaned = rawText.replace(/^\)\]\}'\s*\n?/, '').trim();
  if (!cleaned) return candidates;

  try {
    const parsed = JSON.parse(cleaned);
    collectTokenCandidates(parsed, candidates);
    return candidates;
  } catch {
    // Parse Google batchexecute multi-line envelopes
  }

  const lines = cleaned.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith('[')) continue;
    try {
      const outer = JSON.parse(trimmedLine);
      if (!Array.isArray(outer)) continue;
      for (const entry of outer) {
        if (Array.isArray(entry) && typeof entry[2] === 'string') {
          try {
            const inner = JSON.parse(entry[2]);
            collectTokenCandidates(inner, candidates);
          } catch {
            // Ignore malformed inner JSON
          }
        }
      }
    } catch {
      // Ignore non-JSON chunk lines
    }
  }

  return candidates;
}

export function inspectShoppingResponse(
  responseBody: string,
  requestPostData?: string | null
): ShoppingPayloadInspection {
  const candidates = extractCandidatesFromRawText(responseBody);

  if (candidates.length === 0 && requestPostData) {
    try {
      const params = new URLSearchParams(requestPostData);
      const fReq = params.get('f.req');
      if (fReq) {
        candidates.push(...extractCandidatesFromRawText(fReq));
      }
    } catch {
      // Ignore malformed form payloads
    }
  }

  let matchedInspection: ShoppingPayloadInspection | null = null;

  for (const candidate of candidates) {
    const inspection = inspectDecodedQueryToken(candidate);
    if (!inspection) continue;

    if (inspection.isBaselineUnfilteredEconomy) {
      return inspection;
    }

    if (!matchedInspection || inspection.hasExplicitExclusion) {
      matchedInspection = inspection;
    }
  }

  if (matchedInspection) {
    return matchedInspection;
  }

  return {
    hasValidQueryToken: false,
    hasExplicitExclusion: false,
    isBaselineUnfilteredEconomy: false,
    filterSignature: null,
  };
}