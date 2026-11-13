import { NextRequest, NextResponse } from 'next/server';
import { executeQueuedScrape } from '@/scraper/googleFlightsScraper';
import { isAdminAuthenticated } from '@/utils/auth';
import { scrapeRequestSchema } from '@/utils/validation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
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
      { error: parsed.error.issues[0]?.message ?? 'Invalid scrape request.' },
      { status: 400 }
    );
  }

  const { httpStatus, response } = await executeQueuedScrape(parsed.data, null);
  return NextResponse.json(response, { status: httpStatus });
}