import { NextRequest, NextResponse } from 'next/server';
import { setGlobalPaused } from '@/db/settings';
import { isAdminAuthenticated } from '@/utils/auth';
import { togglePauseSchema } from '@/utils/validation';

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

  const parsed = togglePauseSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid pause payload.' },
      { status: 400 }
    );
  }

  const settings = setGlobalPaused(parsed.data.paused);

  return NextResponse.json({
    ok: true,
    settings,
  });
}