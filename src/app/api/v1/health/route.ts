import { NextRequest, NextResponse } from 'next/server';
import { getPublicSettings } from '@/db/settings';
import { getQueueDepth } from '@/scraper/queueManager';
import { checkPreScrapeAllowance } from '@/scraper/rateLimiter';
import type { HealthResponse } from '@/types';
import { authenticateApiKey } from '@/utils/apiKeyAuth';
import packageInfo from '../../../../../package.json';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = authenticateApiKey(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = getPublicSettings();
  const allowance = checkPreScrapeAllowance();
  const queueDepth = getQueueDepth();

  const isCooldown = settings.circuitBreakerActive;
  const isRateLimited = !isCooldown && !allowance.allowed;

  const status: HealthResponse['status'] = isCooldown
    ? 'cooldown'
    : isRateLimited
      ? 'rate_limited'
      : 'ok';

  const state: HealthResponse['state'] = isCooldown
    ? 'cooldown'
    : isRateLimited
      ? 'rate_limited'
      : 'ready';

  const statusReason = isCooldown
    ? settings.circuitBreakerReason || 'Circuit breaker active due to upstream rate limiting.'
    : isRateLimited
      ? allowance.reason
      : null;

  const payload: HealthResponse = {
    status,
    state,
    version: packageInfo.version,
    apiVersion: 'v1',
    circuitBreakerActive: isCooldown,
    rateLimited: isRateLimited,
    statusReason,
    retryAfter: isCooldown ? settings.circuitBreakerUntil : allowance.retryAfter,
    queueDepth,
    usage: allowance.usage,
  };

  return NextResponse.json(payload, { status: 200 });
}