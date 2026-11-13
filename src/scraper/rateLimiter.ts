import type { Page } from 'playwright';
import { getRollingUsageCounts } from '@/db/logs';
import { getSettings, tripCircuitBreaker } from '@/db/settings';
import type { UsageQuotaStats } from '@/types';

export interface RateCheckResult {
  allowed: boolean;
  paused: boolean;
  reason: string | null;
  retryAfter: string | null;
  usage: UsageQuotaStats;
}

export function getUsageStats(): UsageQuotaStats {
  const settings = getSettings();
  const counts = getRollingUsageCounts();
  return {
    hourlyUsed: counts.hourlyUsed,
    hourlyLimit: settings.maxRequestsPerHour,
    dailyUsed: counts.dailyUsed,
    dailyLimit: settings.maxRequestsPerDay,
  };
}

export function checkPreScrapeAllowance(): RateCheckResult {
  const settings = getSettings();
  const usage = getUsageStats();

  if (settings.globalPaused) {
    return {
      allowed: false,
      paused: true,
      reason: 'Scraper is globally paused by an administrator.',
      retryAfter: null,
      usage,
    };
  }

  if (settings.circuitBreakerUntil) {
    const expiresAt = Date.parse(settings.circuitBreakerUntil);
    if (!Number.isNaN(expiresAt) && Date.now() < expiresAt) {
      return {
        allowed: false,
        paused: false,
        reason:
          settings.circuitBreakerReason ||
          'Circuit breaker active due to upstream rate limiting.',
        retryAfter: settings.circuitBreakerUntil,
        usage,
      };
    }
  }

  if (usage.hourlyUsed >= settings.maxRequestsPerHour) {
    const retryAfter = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    return {
      allowed: false,
      paused: false,
      reason: `Hourly scrape limit reached (${usage.hourlyUsed}/${settings.maxRequestsPerHour}).`,
      retryAfter,
      usage,
    };
  }

  if (usage.dailyUsed >= settings.maxRequestsPerDay) {
    const retryAfter = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    return {
      allowed: false,
      paused: false,
      reason: `Daily scrape limit reached (${usage.dailyUsed}/${settings.maxRequestsPerDay}).`,
      retryAfter,
      usage,
    };
  }

  return {
    allowed: true,
    paused: false,
    reason: null,
    retryAfter: null,
    usage,
  };
}

export async function inspectForUpstreamBlock(
  page: Page,
  httpStatus: number | null,
  hasParsedFlights: boolean
): Promise<{ blocked: boolean; reason: string | null; retryAfter: string | null }> {
  if (httpStatus === 429 || httpStatus === 403) {
    const reason = `Google Flights returned HTTP ${httpStatus}.`;
    const retryAfter = tripCircuitBreaker(reason);
    return { blocked: true, reason, retryAfter };
  }

  const currentUrl = page.url().toLowerCase();
  if (currentUrl.includes('/sorry/index')) {
    const reason = 'Google automated traffic sorry page (/sorry/index) triggered.';
    const retryAfter = tripCircuitBreaker(reason);
    return { blocked: true, reason, retryAfter };
  }

  if (currentUrl.includes('consent.google.com')) {
    const reason = 'Navigation remained blocked on consent.google.com interstitial.';
    const retryAfter = tripCircuitBreaker(reason);
    return { blocked: true, reason, retryAfter };
  }

  if (!hasParsedFlights) {
    const html = await page.content();
    const lowerHtml = html.toLowerCase();

    if (
      lowerHtml.includes('unusual traffic') ||
      lowerHtml.includes('systems have detected unusual traffic')
    ) {
      const reason = 'Google detected unusual traffic from this egress IP.';
      const retryAfter = tripCircuitBreaker(reason);
      return { blocked: true, reason, retryAfter };
    }

    const hasRecaptcha = await page
      .locator('iframe[src*="recaptcha"]')
      .count()
      .catch(() => 0);

    if (hasRecaptcha > 0) {
      const reason = 'Google served a reCAPTCHA challenge with no flight payload.';
      const retryAfter = tripCircuitBreaker(reason);
      return { blocked: true, reason, retryAfter };
    }
  }

  return { blocked: false, reason: null, retryAfter: null };
}