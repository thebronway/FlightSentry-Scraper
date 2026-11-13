export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

export type FareTier = 'Basic' | 'Standard';

export type ScrapeStatus = 'Success' | 'SoldOut' | 'RateLimited' | 'Error';
export interface ScrapeRequest {
  origin: string | string[];
  destination: string | string[];
  departureDate: string;
  cabinClass: CabinClass;
  fareTier: FareTier;
  currency: string;
  maxStops?: number;
  includedAirlines?: string[];
  excludedAirlines?: string[];
  airline?: string;
  flightNumber?: string;
  includeRaw?: boolean;
}

export interface RouteSegment {
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
}

export interface RouteItinerary {
  airline: string;
  airlineName: string;
  flightNumber: string;
  origin: string;
  destination: string;
  price: number;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  durationMinutes: number;
  stops: number;
  isNonstop: boolean;
  layoverAirports: string[];
  maxLayoverMinutes?: number | null;
  legs?: RouteSegment[];
}

export interface ScrapeMeta {
  durationMs: number;
  retryAfter: string | null;
  rawPayload: string | null;
}

export interface ScrapeResponse {
  status: ScrapeStatus;
  price: number | null;
  currency: string;
  leadingAirline: string | null;
  leadingFlightNumber: string | null;
  itineraries: RouteItinerary[];
  errorMessage: string | null;
  meta: ScrapeMeta;
}

export interface ScraperSettings {
  id: number;
  adminPasswordHash: string | null;
  sessionSecret: string;
  minJitterMs: number;
  maxJitterMs: number;
  settleDelayMs: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  cooldownMinutes: number;
  circuitBreakerUntil: string | null;
  circuitBreakerReason: string | null;
  proxyUrl: string | null;
  updatedAt: string;
}

export interface PublicScraperSettings {
  hasAdminPassword: boolean;
  minJitterMs: number;
  maxJitterMs: number;
  settleDelayMs: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  cooldownMinutes: number;
  circuitBreakerActive: boolean;
  circuitBreakerUntil: string | null;
  circuitBreakerReason: string | null;
  hasProxy: boolean;
  maskedProxyUrl: string | null;
  updatedAt: string;
}

export interface ApiKeyRecord {
  id: number;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreatedApiKeyResponse {
  record: ApiKeyRecord;
  rawKey: string;
}

export interface ScrapeLogEntry {
  id: number;
  apiKeyId: number | null;
  route: string;
  flightNumber: string | null;
  departureDate: string;
  cabinClass: string;
  fareTier: string;
  status: ScrapeStatus;
  statusCode: number;
  itineraryCount: number;
  lowestPrice: number | null;
  currency: string | null;
  errorMessage: string | null;
  durationMs: number;
  queriedAt: string;
}

export interface UsageQuotaStats {
  hourlyUsed: number;
  hourlyLimit: number;
  dailyUsed: number;
  dailyLimit: number;
}

export interface HealthResponse {
  status: 'ok' | 'rate_limited' | 'cooldown';
  state: 'ready' | 'rate_limited' | 'cooldown';
  version: string;
  apiVersion: string;
  circuitBreakerActive: boolean;
  rateLimited: boolean;
  statusReason: string | null;
  retryAfter: string | null;
  queueDepth: number;
  usage: UsageQuotaStats;
}