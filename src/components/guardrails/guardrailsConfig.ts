export const DEFAULT_GUARDRAILS = {
  minJitterMs: 4000,
  maxJitterMs: 9000,
  settleDelayMs: 2500,
  maxRequestsPerHour: 20,
  maxRequestsPerDay: 150,
  cooldownMinutes: 60,
} as const;

export interface GuardrailValues {
  minJitterMs: number;
  maxJitterMs: number;
  settleDelayMs: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  cooldownMinutes: number;
}

export interface GuardrailFieldMeta {
  key: keyof GuardrailValues;
  label: string;
  description: string;
  defaultLabel: string;
  min: number;
  max: number;
}

export const GUARDRAIL_FIELDS: readonly GuardrailFieldMeta[] = [
  {
    key: 'minJitterMs',
    label: 'Min Jitter (ms)',
    description:
      'Minimum randomized delay (ms) before navigating to Google Flights',
    defaultLabel: '(Default: 4000ms [4 seconds])',
    min: 500,
    max: 60000,
  },
  {
    key: 'maxJitterMs',
    label: 'Max Jitter (ms)',
    description:
      'Maximum randomized delay (ms) before navigating to Google Flights',
    defaultLabel: '(Default: 9000ms [9 seconds])',
    min: 500,
    max: 120000,
  },
  {
    key: 'settleDelayMs',
    label: 'Settle Delay (ms)',
    description:
      'Wait time (ms) after page load for dynamic flight prices to render',
    defaultLabel: '(Default: 2500ms [2.5 seconds])',
    min: 500,
    max: 30000,
  },
  {
    key: 'maxRequestsPerHour',
    label: 'Hourly Cap',
    description:
      'Maximum allowed scrape requests per rolling 60-minute window',
    defaultLabel: '(Default: 20)',
    min: 1,
    max: 500,
  },
  {
    key: 'maxRequestsPerDay',
    label: 'Daily Cap',
    description:
      'Maximum amount of allowed scrape requests per rolling 24-hour window',
    defaultLabel: '(Default: 150)',
    min: 1,
    max: 5000,
  },
  {
    key: 'cooldownMinutes',
    label: 'Cooldown (min)',
    description:
      'Pause duration (minutes) when Google triggers a CAPTCHA or 429 block',
    defaultLabel: '(Default: 60m)',
    min: 1,
    max: 1440,
  },
];