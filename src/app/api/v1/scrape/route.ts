import { NextRequest, NextResponse } from 'next/server';
import { executeQueuedScrape } from '@/scraper/googleFlightsScraper';
import { authenticateApiKey } from '@/utils/apiKeyAuth';
import { scrapeRequestSchema } from '@/utils/validation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = authenticateApiKey(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const parsed = scrapeRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Invalid scrape request.',
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const { httpStatus, response } = await executeQueuedScrape(
    parsed.data,
    auth.keyId
  );

  const headers: Record<string, string> = {};
  if (httpStatus === 429 && response.meta.retryAfter) {
    headers['Retry-After'] = response.meta.retryAfter;
  }

  return NextResponse.json(response, { status: httpStatus, headers });
}