import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, listApiKeys } from '@/db/apiKeys';
import { generateApiKey } from '@/utils/apiKeyAuth';
import { isAdminAuthenticated } from '@/utils/auth';
import { createApiKeySchema } from '@/utils/validation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    keys: listApiKeys(),
  });
}

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

  const parsed = createApiKeySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid key name.' },
      { status: 400 }
    );
  }

  const { rawKey, keyPrefix, keyHash } = generateApiKey();
  const record = createApiKey(parsed.data.name, keyPrefix, keyHash);

  return NextResponse.json(
    {
      record,
      rawKey,
    },
    { status: 201 }
  );
}