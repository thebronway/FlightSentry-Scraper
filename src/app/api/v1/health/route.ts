import { NextRequest, NextResponse } from 'next/server';
import { getPublicSettings } from '@/db/settings';
import { getQueueDepth } from '@/scraper/queueManager';
import { getUsageStats } from '@/scraper/rateLimiter';
import type { HealthResponse } from '@/types';
import { authenticateApiKey } from '@/utils/apiKeyAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = authenticateApiKey(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = getPublicSettings();
  const usage = getUsageStats();
  const queueDepth = getQueueDepth();

  const payload: HealthResponse = {
    status: settings.circuitBreakerActive ? 'cooldown' : 'ok',
    version: '0.1.0',
    circuitBreakerActive: settings.circuitBreakerActive,
    retryAfter: settings.circuitBreakerUntil,
    queueDepth,
    usage,
  };

  return NextResponse.json(payload, { status: 200 });
}