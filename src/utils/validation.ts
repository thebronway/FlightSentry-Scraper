import { z } from 'zod';

const AIRPORT_LIST_REGEX = /^[A-Z]{3}(,[A-Z]{3})*$/;
const IATA_CARRIER_REGEX = /^[A-Z0-9]{2}$/;
const FLIGHT_NUMBER_REGEX = /^[A-Za-z0-9]{1,8}$/;
const DATE_YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  if (!DATE_YYYY_MM_DD_REGEX.test(value)) return false;
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isValidProxyUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'http:' ||
        parsed.protocol === 'https:' ||
        parsed.protocol === 'socks5:') &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export const authActionSchema = z
  .discriminatedUnion('action', [
    z.object({
      action: z.literal('setup'),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters.')
        .max(128, 'Password cannot exceed 128 characters.'),
      confirmPassword: z.string(),
    }),
    z.object({
      action: z.literal('login'),
      password: z.string().min(1, 'Password is required.').max(128),
    }),
    z.object({
      action: z.literal('logout'),
    }),
  ])
  .superRefine((data, ctx) => {
    if (data.action === 'setup' && data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match.',
        path: ['confirmPassword'],
      });
    }
  });

export const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Key name is required.')
    .max(64, 'Key name must be 64 characters or fewer.'),
});

export const updateSettingsSchema = z
  .object({
    minJitterMs: z.number().int().min(500).max(60000),
    maxJitterMs: z.number().int().min(500).max(120000),
    settleDelayMs: z.number().int().min(500).max(30000),
    maxRequestsPerHour: z.number().int().min(1).max(500),
    maxRequestsPerDay: z.number().int().min(1).max(5000),
    cooldownMinutes: z.number().int().min(1).max(1440),
    proxyUrl: z
      .string()
      .trim()
      .max(512)
      .refine((val) => val === '' || isValidProxyUrl(val), {
        message: 'Proxy URL must use http://, https://, or socks5://.',
      })
      .nullable()
      .optional(),
    currentPassword: z.string().max(128).optional(),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters.')
      .max(128)
      .optional(),
    confirmNewPassword: z.string().max(128).optional(),
  })
  .refine((data) => data.maxJitterMs >= data.minJitterMs, {
    message: 'Max jitter must be greater than or equal to min jitter.',
    path: ['maxJitterMs'],
  })
  .refine((data) => data.maxRequestsPerDay >= data.maxRequestsPerHour, {
    message: 'Daily limit must be greater than or equal to hourly limit.',
    path: ['maxRequestsPerDay'],
  })
  .refine(
    (data) => {
      if (!data.newPassword) return true;
      return Boolean(data.currentPassword && data.currentPassword.length > 0);
    },
    {
      message: 'Current password is required to set a new password.',
      path: ['currentPassword'],
    }
  )
  .refine(
    (data) => {
      if (!data.newPassword) return true;
      return data.newPassword === data.confirmNewPassword;
    },
    {
      message: 'New passwords do not match.',
      path: ['confirmNewPassword'],
    }
  );

export const scrapeRequestSchema = z.object({
  origin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      AIRPORT_LIST_REGEX,
      'Origin must be a 3-letter IATA/metro code or comma-separated list (e.g. WAS or DCA,IAD).'
    ),
  destination: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      AIRPORT_LIST_REGEX,
      'Destination must be a 3-letter IATA/metro code or comma-separated list (e.g. SFO).'
    ),
  departureDate: z
    .string()
    .trim()
    .refine(isValidCalendarDate, {
      message: 'departureDate must be a valid YYYY-MM-DD date.',
    }),
  cabinClass: z
    .enum(['economy', 'premium_economy', 'business', 'first'])
    .default('economy'),
  fareTier: z.enum(['Basic', 'Standard']).default('Standard'),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code (e.g. USD).')
    .default('USD'),
  maxStops: z.number().int().min(0).max(3).optional(),
  includedAirlines: z
    .array(z.string().trim().toUpperCase().regex(IATA_CARRIER_REGEX))
    .max(20)
    .optional(),
  excludedAirlines: z
    .array(z.string().trim().toUpperCase().regex(IATA_CARRIER_REGEX))
    .max(20)
    .optional(),
  airline: z
    .string()
    .trim()
    .toUpperCase()
    .regex(IATA_CARRIER_REGEX)
    .optional(),
  flightNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(FLIGHT_NUMBER_REGEX)
    .optional(),
  includeRaw: z.boolean().default(false),
});