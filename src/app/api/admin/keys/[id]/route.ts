import { NextRequest, NextResponse } from 'next/server';
import { revokeApiKey } from '@/db/apiKeys';
import { isAdminAuthenticated } from '@/utils/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keyId = Number(context.params.id);
  if (!Number.isInteger(keyId) || keyId <= 0) {
    return NextResponse.json({ error: 'Invalid API key ID.' }, { status: 400 });
  }

  const revoked = revokeApiKey(keyId);
  if (!revoked) {
    return NextResponse.json(
      { error: 'API key not found or already revoked.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}