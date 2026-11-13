import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  getPublicSettings,
  getSettings,
  updateAdminPassword,
  updateGuardrails,
} from '@/db/settings';
import {
  attachSessionCookie,
  hashPassword,
  isAdminAuthenticated,
  verifyPassword,
} from '@/utils/auth';
import { updateSettingsSchema } from '@/utils/validation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    settings: getPublicSettings(),
  });
}

export async function PUT(req: NextRequest) {
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

  const parsed = updateSettingsSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid settings.' },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const current = getSettings();
  let rotatedSecret: string | null = null;

  if (data.newPassword) {
    if (
      !current.adminPasswordHash ||
      !data.currentPassword ||
      !verifyPassword(data.currentPassword, current.adminPasswordHash)
    ) {
      return NextResponse.json(
        { error: 'Current admin password is incorrect.' },
        { status: 401 }
      );
    }

    const newHash = hashPassword(data.newPassword);
    rotatedSecret = crypto.randomBytes(32).toString('hex');
    updateAdminPassword(newHash, rotatedSecret);
  }

  updateGuardrails({
    minJitterMs: data.minJitterMs,
    maxJitterMs: data.maxJitterMs,
    settleDelayMs: data.settleDelayMs,
    maxRequestsPerHour: data.maxRequestsPerHour,
    maxRequestsPerDay: data.maxRequestsPerDay,
    cooldownMinutes: data.cooldownMinutes,
    proxyUrl: data.proxyUrl,
  });

  const res = NextResponse.json({
    ok: true,
    settings: getPublicSettings(),
  });

  if (rotatedSecret) {
    attachSessionCookie(res, req, rotatedSecret);
  }

  return res;
}