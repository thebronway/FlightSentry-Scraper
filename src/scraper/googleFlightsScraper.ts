import type { Page } from 'playwright';
import { insertScrapeLog } from '@/db/logs';
import { getSettings } from '@/db/settings';
import type { ScrapeRequest, ScrapeResponse } from '@/types';
import { formatLocationDisplay } from '@/utils/coLocations';
import { openIsolatedGooglePage } from './browserManager';
import {
  applyScrapeFilters,
  extractDs1JsonFromHtml,
  parseItinerariesFromDom,
  parseStructuredPayload,
} from './flightParser';
import { enqueueScrape } from './queueManager';
import {
  checkPreScrapeAllowance,
  inspectForUpstreamBlock,
} from './rateLimiter';
import { buildGoogleFlightsUrl } from './urlBuilder';

const HARD_SCRAPE_TIMEOUT_MS = 30_000;
const MAX_RAW_PAYLOAD_BYTES = 50 * 1024; // 50 KB cap

export interface ScrapeExecutionResult {
  httpStatus: number;
  response: ScrapeResponse;
}

function truncateRawPayload(chunks: string[]): string | null {
  if (chunks.length === 0) return null;
  const joined = chunks.join('\n---CHUNK---\n');
  if (Buffer.byteLength(joined, 'utf8') <= MAX_RAW_PAYLOAD_BYTES) {
    return joined;
  }
  return joined.slice(0, MAX_RAW_PAYLOAD_BYTES) + '\n...[TRUNCATED_50KB]';
}

async function dismissConsentIfPresent(page: Page): Promise<void> {
  if (!page.url().includes('consent.google.com')) {
    return;
  }

  const acceptSelectors = [
    'button[aria-label*="Accept all" i]',
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'form[action*="consent"] button',
  ];

  for (const selector of acceptSelectors) {
    const btn = page.locator(selector).first();
    const visible = await btn.isVisible().catch(() => false);
    if (visible) {
      await Promise.all([
        page
          .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 })
          .catch(() => null),
        btn.click({ timeout: 4000 }).catch(() => null),
      ]);
      break;
    }
  }
}

async function performBrowserScrape(
  req: ScrapeRequest,
  apiKeyId: number | null
): Promise<ScrapeExecutionResult> {
  const startedAt = Date.now();
  const routeLabel = `${formatLocationDisplay(req.origin)} -> ${formatLocationDisplay(req.destination)}`;
  const flightLabel =
    req.airline || req.flightNumber
      ? `${req.airline ?? ''}${req.flightNumber ?? ''}`
      : null;

  // Re-check rate limits & circuit breaker immediately before launching a page
  const preCheck = checkPreScrapeAllowance();
  if (!preCheck.allowed) {
    const durationMs = Date.now() - startedAt;
    const response: ScrapeResponse = {
      status: 'RateLimited',
      price: null,
      currency: req.currency,
      leadingAirline: null,
      leadingFlightNumber: null,
      itineraries: [],
      errorMessage: preCheck.reason,
      meta: {
        durationMs,
        retryAfter: preCheck.retryAfter,
        rawPayload: null,
      },
    };

    insertScrapeLog({
      apiKeyId,
      route: routeLabel,
      flightNumber: flightLabel,
      departureDate: req.departureDate,
      cabinClass: req.cabinClass,
      fareTier: req.fareTier,
      status: 'RateLimited',
      statusCode: 429,
      itineraryCount: 0,
      lowestPrice: null,
      currency: req.currency,
      errorMessage: preCheck.reason,
      durationMs,
      queriedAt: new Date().toISOString(),
    });

    return { httpStatus: 429, response };
  }

  const settings = getSettings();
  const targetUrl = buildGoogleFlightsUrl(req);
  const interceptedPayloads: string[] = [];
  let mainHttpStatus: number | null = null;
  let page: Page | null = null;

  try {
    page = await openIsolatedGooglePage();
    page.setDefaultTimeout(HARD_SCRAPE_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(HARD_SCRAPE_TIMEOUT_MS);

    page.on('response', async (res) => {
      try {
        const resUrl = res.url();
        if (
          resUrl.includes('/_/FlightsFrontendUi/data/') ||
          resUrl.includes('GetShoppingResults')
        ) {
          const bodyText = await res.text();
          if (bodyText && bodyText.length > 100) {
            interceptedPayloads.push(bodyText);
          }
        }
      } catch {
        // Ignore streaming or aborted responses
      }
    });

    const navResponse = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: HARD_SCRAPE_TIMEOUT_MS,
    });
    mainHttpStatus = navResponse ? navResponse.status() : null;

    await dismissConsentIfPresent(page);

    await page
      .waitForLoadState('networkidle', { timeout: 12_000 })
      .catch(() => null);

    await page.waitForTimeout(settings.settleDelayMs);

    const html = await page.content();
    const ds1Payload = extractDs1JsonFromHtml(html);
    if (ds1Payload) {
      interceptedPayloads.unshift(ds1Payload);
    }

    let itineraries = parseStructuredPayload(
      interceptedPayloads,
      req.departureDate
    );

    if (itineraries.length === 0) {
      itineraries = await parseItinerariesFromDom(page, req);
    }

    const blockCheck = await inspectForUpstreamBlock(
      page,
      mainHttpStatus,
      itineraries.length > 0
    );

    if (blockCheck.blocked) {
      const durationMs = Date.now() - startedAt;
      const response: ScrapeResponse = {
        status: 'RateLimited',
        price: null,
        currency: req.currency,
        leadingAirline: null,
        leadingFlightNumber: null,
        itineraries: [],
        errorMessage: blockCheck.reason,
        meta: {
          durationMs,
          retryAfter: blockCheck.retryAfter,
          rawPayload: req.includeRaw
            ? truncateRawPayload(interceptedPayloads)
            : null,
        },
      };

      insertScrapeLog({
        apiKeyId,
        route: routeLabel,
        flightNumber: flightLabel,
        departureDate: req.departureDate,
        cabinClass: req.cabinClass,
        fareTier: req.fareTier,
        status: 'RateLimited',
        statusCode: 429,
        itineraryCount: 0,
        lowestPrice: null,
        currency: req.currency,
        errorMessage: blockCheck.reason,
        durationMs,
        queriedAt: new Date().toISOString(),
      });

      return { httpStatus: 429, response };
    }

    const filtered = applyScrapeFilters(itineraries, req);
    const durationMs = Date.now() - startedAt;

    if (filtered.length === 0) {
      const response: ScrapeResponse = {
        status: 'SoldOut',
        price: null,
        currency: req.currency,
        leadingAirline: null,
        leadingFlightNumber: null,
        itineraries: [],
        errorMessage: null,
        meta: {
          durationMs,
          retryAfter: null,
          rawPayload: req.includeRaw
            ? truncateRawPayload(interceptedPayloads)
            : null,
        },
      };

      insertScrapeLog({
        apiKeyId,
        route: routeLabel,
        flightNumber: flightLabel,
        departureDate: req.departureDate,
        cabinClass: req.cabinClass,
        fareTier: req.fareTier,
        status: 'SoldOut',
        statusCode: 200,
        itineraryCount: 0,
        lowestPrice: null,
        currency: req.currency,
        errorMessage: null,
        durationMs,
        queriedAt: new Date().toISOString(),
      });

      return { httpStatus: 200, response };
    }

    const best = filtered[0];
    const response: ScrapeResponse = {
      status: 'Success',
      price: best.price,
      currency: req.currency,
      leadingAirline: best.airline,
      leadingFlightNumber: best.flightNumber || null,
      itineraries: filtered,
      errorMessage: null,
      meta: {
        durationMs,
        retryAfter: null,
        rawPayload: req.includeRaw
          ? truncateRawPayload(interceptedPayloads)
          : null,
      },
    };

    insertScrapeLog({
      apiKeyId,
      route: routeLabel,
      flightNumber: flightLabel,
      departureDate: req.departureDate,
      cabinClass: req.cabinClass,
      fareTier: req.fareTier,
      status: 'Success',
      statusCode: 200,
      itineraryCount: filtered.length,
      lowestPrice: best.price,
      currency: req.currency,
      errorMessage: null,
      durationMs,
      queriedAt: new Date().toISOString(),
    });

    return { httpStatus: 200, response };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message =
      err instanceof Error ? err.message : 'Unexpected Playwright failure.';
    const isTimeout = /timeout/i.test(message);
    const httpStatus = isTimeout ? 504 : 502;

    const response: ScrapeResponse = {
      status: 'Error',
      price: null,
      currency: req.currency,
      leadingAirline: null,
      leadingFlightNumber: null,
      itineraries: [],
      errorMessage: message,
      meta: {
        durationMs,
        retryAfter: null,
        rawPayload: req.includeRaw
          ? truncateRawPayload(interceptedPayloads)
          : null,
      },
    };

    insertScrapeLog({
      apiKeyId,
      route: routeLabel,
      flightNumber: flightLabel,
      departureDate: req.departureDate,
      cabinClass: req.cabinClass,
      fareTier: req.fareTier,
      status: 'Error',
      statusCode: httpStatus,
      itineraryCount: 0,
      lowestPrice: null,
      currency: req.currency,
      errorMessage: message,
      durationMs,
      queriedAt: new Date().toISOString(),
    });

    return { httpStatus, response };
  } finally {
    if (page) {
      await page.close().catch(() => null);
    }
  }
}

export async function executeQueuedScrape(
  req: ScrapeRequest,
  apiKeyId: number | null
): Promise<ScrapeExecutionResult> {
  // Fast-fail before queueing if hourly/daily cap or circuit breaker is already tripped
  const immediateCheck = checkPreScrapeAllowance();
  if (!immediateCheck.allowed) {
    const routeLabel = `${formatLocationDisplay(req.origin)} -> ${formatLocationDisplay(req.destination)}`;
    const flightLabel =
      req.airline || req.flightNumber
        ? `${req.airline ?? ''}${req.flightNumber ?? ''}`
        : null;

    const response: ScrapeResponse = {
      status: 'RateLimited',
      price: null,
      currency: req.currency,
      leadingAirline: null,
      leadingFlightNumber: null,
      itineraries: [],
      errorMessage: immediateCheck.reason,
      meta: {
        durationMs: 0,
        retryAfter: immediateCheck.retryAfter,
        rawPayload: null,
      },
    };

    insertScrapeLog({
      apiKeyId,
      route: routeLabel,
      flightNumber: flightLabel,
      departureDate: req.departureDate,
      cabinClass: req.cabinClass,
      fareTier: req.fareTier,
      status: 'RateLimited',
      statusCode: 429,
      itineraryCount: 0,
      lowestPrice: null,
      currency: req.currency,
      errorMessage: immediateCheck.reason,
      durationMs: 0,
      queriedAt: new Date().toISOString(),
    });

    return { httpStatus: 429, response };
  }

  return enqueueScrape(() => performBrowserScrape(req, apiKeyId));
}