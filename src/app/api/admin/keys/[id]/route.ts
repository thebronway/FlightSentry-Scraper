import { NextRequest, NextResponse } from 'next/server';
import {
  deleteRevokedApiKey,
  getApiKeyById,
  revokeApiKey,
} from '@/db/apiKeys';
import { isAdminAuthenticated } from '@/utils/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
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

  const existing = getApiKeyById(keyId);
  if (!existing) {
    return NextResponse.json({ error: 'API key not found.' }, { status: 404 });
  }

  if (!existing.revokedAt) {
    return NextResponse.json(
      { error: 'API key must be revoked before it can be deleted.' },
      { status: 400 }
    );
  }

  const deleted = deleteRevokedApiKey(keyId);
  if (!deleted) {
    return NextResponse.json(
      { error: 'Failed to delete revoked API key.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}