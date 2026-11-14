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
import { inspectShoppingResponse } from './shoppingTokenInspector';
import { buildGoogleFlightsUrl } from './urlBuilder';

const HARD_SCRAPE_TIMEOUT_MS = 30_000;
const POST_FILTER_WAIT_TIMEOUT_MS = 10_000;
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

  // Re-check global pause, rate limits & circuit breaker immediately before launching a page
  const preCheck = checkPreScrapeAllowance();
  if (!preCheck.allowed) {
    const isPaused = preCheck.paused;
    const status = isPaused ? 'Paused' : 'RateLimited';
    const httpStatus = isPaused ? 503 : 429;
    const durationMs = Date.now() - startedAt;
    const response: ScrapeResponse = {
      status,
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
      status,
      statusCode: httpStatus,
      itineraryCount: 0,
      lowestPrice: null,
      currency: req.currency,
      errorMessage: preCheck.reason,
      durationMs,
      queriedAt: new Date().toISOString(),
    });

    return { httpStatus, response };
  }

  const settings = getSettings();
  const requireBasicExclusion =
    req.cabinClass === 'economy' && req.fareTier === 'Standard';
  const targetUrl = buildGoogleFlightsUrl(req, {
    excludeBasicEconomy: requireBasicExclusion,
  });
  let interceptedPayloads: string[] = [];
  let page: Page | null = null;

  const runNavigationAttempt = async (
    activePage: Page,
    navigationUrl: string,
    enforceBasicExclusion: boolean
  ) => {
    const postFilterShoppingPayloads: string[] = [];
    const allShoppingPayloads: string[] = [];
    const otherDataPayloads: string[] = [];
    let sawUnfilteredShopping = false;
    let initialUnfilteredSignature: string | null = null;
    let resolvePostFilter: (() => void) | null = null;

    const postFilterReadyPromise = new Promise<void>((resolve) => {
      resolvePostFilter = resolve;
    });

    const onResponse = async (res: import('playwright').Response) => {
      try {
        const resUrl = res.url();
        const isShoppingRpc = resUrl.includes('GetShoppingResults');
        const isFrontendDataRpc = resUrl.includes('/_/FlightsFrontendUi/data/');
        if (!isShoppingRpc && !isFrontendDataRpc) {
          return;
        }

        // Ignore non-itinerary background RPCs (calendar price graphs, price insights, explore teasers)
        if (
          /GetCalendar|PriceInsights|Explore|Autocomplete|Location/i.test(
            resUrl
          )
        ) {
          return;
        }

        const bodyText = await res.text();
        if (!bodyText || bodyText.length <= 100) {
          return;
        }

        if (!isShoppingRpc) {
          otherDataPayloads.push(bodyText);
          return;
        }

        allShoppingPayloads.push(bodyText);

        if (!enforceBasicExclusion) {
          postFilterShoppingPayloads.push(bodyText);
          resolvePostFilter?.();
          return;
        }

        const postData = res.request().postData();
        const inspection = inspectShoppingResponse(bodyText, postData);

        if (inspection.hasExplicitExclusion) {
          postFilterShoppingPayloads.push(bodyText);
          resolvePostFilter?.();
          return;
        }

        if (inspection.isBaselineUnfilteredEconomy) {
          sawUnfilteredShopping = true;
          if (!initialUnfilteredSignature) {
            initialUnfilteredSignature = inspection.filterSignature;
          }
          return;
        }

        if (
          sawUnfilteredShopping &&
          (!inspection.hasValidQueryToken ||
            inspection.filterSignature !== initialUnfilteredSignature)
        ) {
          postFilterShoppingPayloads.push(bodyText);
          resolvePostFilter?.();
          return;
        }

        if (!inspection.hasValidQueryToken) {
          postFilterShoppingPayloads.push(bodyText);
          resolvePostFilter?.();
        }
      } catch {
        // Ignore streaming or aborted responses
      }
    };

    activePage.on('response', onResponse);

    try {
      const navResponse = await activePage.goto(navigationUrl, {
        waitUntil: 'domcontentloaded',
        timeout: HARD_SCRAPE_TIMEOUT_MS,
      });
      const httpStatus = navResponse ? navResponse.status() : null;

      await dismissConsentIfPresent(activePage);

      await activePage
        .waitForLoadState('networkidle', { timeout: 12_000 })
        .catch(() => null);

      await activePage.waitForTimeout(settings.settleDelayMs);

      if (
        enforceBasicExclusion &&
        postFilterShoppingPayloads.length === 0 &&
        sawUnfilteredShopping
      ) {
        await Promise.race([
          postFilterReadyPromise,
          activePage.waitForTimeout(POST_FILTER_WAIT_TIMEOUT_MS),
        ]);
      }

      const html = await activePage.content();
      const ds1Payload = extractDs1JsonFromHtml(html);

      let structuredCandidates: string[] = [];
      let rawDiagnosticPayloads: string[] = [];

      if (enforceBasicExclusion) {
        if (postFilterShoppingPayloads.length > 0) {
          const latestFiltered =
            postFilterShoppingPayloads[postFilterShoppingPayloads.length - 1];
          structuredCandidates = [latestFiltered];
          rawDiagnosticPayloads = [latestFiltered];
        } else if (sawUnfilteredShopping) {
          // Pre-filter GetShoppingResults fired, but post-filter XHR did not arrive;
          // fall back to SSR ds:1 (which already carries the tfs excludeBasicEconomy flag) if available.
          if (ds1Payload) {
            structuredCandidates = [ds1Payload];
          }
          rawDiagnosticPayloads = [
            ...(ds1Payload ? [ds1Payload] : []),
            ...allShoppingPayloads,
            ...otherDataPayloads,
          ];
        } else {
          if (ds1Payload) {
            structuredCandidates.push(ds1Payload);
          }
          structuredCandidates.push(...otherDataPayloads);
          rawDiagnosticPayloads = [...structuredCandidates];
        }
      } else {
        if (allShoppingPayloads.length > 0) {
          const latestShopping =
            allShoppingPayloads[allShoppingPayloads.length - 1];
          structuredCandidates = [latestShopping];
          rawDiagnosticPayloads = [latestShopping];
        } else {
          if (ds1Payload) {
            structuredCandidates.push(ds1Payload);
          }
          structuredCandidates.push(...otherDataPayloads);
          rawDiagnosticPayloads = [...structuredCandidates];
        }
      }

      let extracted = parseStructuredPayload(structuredCandidates, req);

      if (
        extracted.length === 0 &&
        !(
          enforceBasicExclusion &&
          sawUnfilteredShopping &&
          postFilterShoppingPayloads.length === 0
        )
      ) {
        extracted = await parseItinerariesFromDom(activePage, req);
      }

      return {
        httpStatus,
        itineraries: extracted,
        rawPayloads: rawDiagnosticPayloads,
      };
    } finally {
      activePage.off('response', onResponse);
    }
  };

  try {
    page = await openIsolatedGooglePage();
    page.setDefaultTimeout(HARD_SCRAPE_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(HARD_SCRAPE_TIMEOUT_MS);

    const primaryAttempt = await runNavigationAttempt(
      page,
      targetUrl,
      requireBasicExclusion
    );
    let itineraries = primaryAttempt.itineraries;
    interceptedPayloads = primaryAttempt.rawPayloads;

    const blockCheck = await inspectForUpstreamBlock(
      page,
      primaryAttempt.httpStatus,
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

    // Google Flights only supports "Economy (exclude Basic)" on North American/US-territory routes;
    // fall back to standard Economy if an international route returns 0 results with excludeBasic enabled.
    if (
      itineraries.length === 0 &&
      req.cabinClass === 'economy' &&
      req.fareTier === 'Standard'
    ) {
      const fallbackUrl = buildGoogleFlightsUrl(req, {
        excludeBasicEconomy: false,
      });
      const fallbackAttempt = await runNavigationAttempt(
        page,
        fallbackUrl,
        false
      );
      itineraries = fallbackAttempt.itineraries;
      interceptedPayloads = fallbackAttempt.rawPayloads;

      const fallbackBlockCheck = await inspectForUpstreamBlock(
        page,
        fallbackAttempt.httpStatus,
        itineraries.length > 0
      );

      if (fallbackBlockCheck.blocked) {
        const durationMs = Date.now() - startedAt;
        const response: ScrapeResponse = {
          status: 'RateLimited',
          price: null,
          currency: req.currency,
          leadingAirline: null,
          leadingFlightNumber: null,
          itineraries: [],
          errorMessage: fallbackBlockCheck.reason,
          meta: {
            durationMs,
            retryAfter: fallbackBlockCheck.retryAfter,
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
          errorMessage: fallbackBlockCheck.reason,
          durationMs,
          queriedAt: new Date().toISOString(),
        });

        return { httpStatus: 429, response };
      }
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
  // Fast-fail before queueing if global pause, hourly/daily cap, or circuit breaker is active
  const immediateCheck = checkPreScrapeAllowance();
  if (!immediateCheck.allowed) {
    const isPaused = immediateCheck.paused;
    const status = isPaused ? 'Paused' : 'RateLimited';
    const httpStatus = isPaused ? 503 : 429;
    const routeLabel = `${formatLocationDisplay(req.origin)} -> ${formatLocationDisplay(req.destination)}`;
    const flightLabel =
      req.airline || req.flightNumber
        ? `${req.airline ?? ''}${req.flightNumber ?? ''}`
        : null;

    const response: ScrapeResponse = {
      status,
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
      status,
      statusCode: httpStatus,
      itineraryCount: 0,
      lowestPrice: null,
      currency: req.currency,
      errorMessage: immediateCheck.reason,
      durationMs: 0,
      queriedAt: new Date().toISOString(),
    });

    return { httpStatus, response };
  }

  return enqueueScrape(() => performBrowserScrape(req, apiKeyId));
}