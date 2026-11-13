import { NextRequest, NextResponse } from 'next/server';
import { getPublicSettings, resetCircuitBreaker } from '@/db/settings';
import { isAdminAuthenticated } from '@/utils/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  resetCircuitBreaker();

  return NextResponse.json({
    ok: true,
    settings: getPublicSettings(),
  });
}