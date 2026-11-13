import { NextRequest, NextResponse } from 'next/server';
import {
  getPublicSettings,
  getSettings,
  setInitialAdminPassword,
} from '@/db/settings';
import {
  attachSessionCookie,
  checkLoginRateLimit,
  clearLoginFailures,
  clearSessionCookie,
  getClientIp,
  hashPassword,
  isAdminAuthenticated,
  recordFailedLogin,
  verifyPassword,
} from '@/utils/auth';
import { authActionSchema } from '@/utils/validation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const settings = getSettings();
  const hasAdminPassword = Boolean(settings.adminPasswordHash);
  const authenticated = hasAdminPassword ? isAdminAuthenticated(req) : false;

  return NextResponse.json({
    hasAdminPassword,
    authenticated,
    settings: authenticated ? getPublicSettings() : null,
  });
}

export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const parsed = authActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Validation failed.',
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.action === 'logout') {
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    return res;
  }

  if (data.action === 'setup') {
    const settings = getSettings();
    if (settings.adminPasswordHash) {
      return NextResponse.json(
        { error: 'Admin password has already been configured.' },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(data.password);
    const updated = setInitialAdminPassword(passwordHash);
    if (!updated) {
      return NextResponse.json(
        { error: 'Admin password has already been configured.' },
        { status: 409 }
      );
    }

    const res = NextResponse.json({
      ok: true,
      hasAdminPassword: true,
      authenticated: true,
      settings: getPublicSettings(),
    });
    attachSessionCookie(res, req, settings.sessionSecret);
    return res;
  }

  // Login flow with per-IP rate limiting
  const clientIp = getClientIp(req);
  const rateLimit = checkLoginRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many failed login attempts. Try again in ${rateLimit.retryAfterSeconds}s.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const settings = getSettings();
  if (!settings.adminPasswordHash) {
    return NextResponse.json(
      { error: 'Initial admin password setup is required first.' },
      { status: 403 }
    );
  }

  const valid = verifyPassword(data.password, settings.adminPasswordHash);
  if (!valid) {
    recordFailedLogin(clientIp);
    return NextResponse.json(
      { error: 'Invalid admin password.' },
      { status: 401 }
    );
  }

  clearLoginFailures(clientIp);
  const res = NextResponse.json({
    ok: true,
    hasAdminPassword: true,
    authenticated: true,
    settings: getPublicSettings(),
  });
  attachSessionCookie(res, req, settings.sessionSecret);
  return res;
}