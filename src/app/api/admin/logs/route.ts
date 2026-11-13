import { NextRequest, NextResponse } from 'next/server';
import { getRecentScrapeLogs, getRollingUsageCounts } from '@/db/logs';
import { isAdminAuthenticated } from '@/utils/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : 50;

  return NextResponse.json({
    logs: getRecentScrapeLogs(Number.isFinite(limit) ? limit : 50),
    usage: getRollingUsageCounts(),
  });
}