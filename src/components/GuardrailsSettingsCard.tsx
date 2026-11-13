'use client';

import { useEffect, useState } from 'react';
import { Info, RotateCcw, Save, Sliders } from 'lucide-react';
import Tooltip from '@/components/common/Tooltip';
import type { PublicScraperSettings } from '@/types';

const DEFAULT_GUARDRAILS = {
  minJitterMs: 4000,
  maxJitterMs: 9000,
  settleDelayMs: 2500,
  maxRequestsPerHour: 20,
  maxRequestsPerDay: 150,
  cooldownMinutes: 60,
} as const;

interface GuardrailsSettingsCardProps {
  settings: PublicScraperSettings;
  onSettingsUpdated: (settings: PublicScraperSettings) => void;
}

export function GuardrailsSettingsCard({
  settings,
  onSettingsUpdated,
}: GuardrailsSettingsCardProps) {
  const [minJitterMs, setMinJitterMs] = useState(settings.minJitterMs);
  const [maxJitterMs, setMaxJitterMs] = useState(settings.maxJitterMs);
  const [settleDelayMs, setSettleDelayMs] = useState(settings.settleDelayMs);
  const [maxRequestsPerHour, setMaxRequestsPerHour] = useState(
    settings.maxRequestsPerHour
  );
  const [maxRequestsPerDay, setMaxRequestsPerDay] = useState(
    settings.maxRequestsPerDay
  );
  const [cooldownMinutes, setCooldownMinutes] = useState(
    settings.cooldownMinutes
  );
  const [proxyInput, setProxyInput] = useState('');
  const [clearProxy, setClearProxy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setMinJitterMs(settings.minJitterMs);
    setMaxJitterMs(settings.maxJitterMs);
    setSettleDelayMs(settings.settleDelayMs);
    setMaxRequestsPerHour(settings.maxRequestsPerHour);
    setMaxRequestsPerDay(settings.maxRequestsPerDay);
    setCooldownMinutes(settings.cooldownMinutes);
  }, [settings]);

  const isAlreadyDefault =
    Number(minJitterMs) === DEFAULT_GUARDRAILS.minJitterMs &&
    Number(maxJitterMs) === DEFAULT_GUARDRAILS.maxJitterMs &&
    Number(settleDelayMs) === DEFAULT_GUARDRAILS.settleDelayMs &&
    Number(maxRequestsPerHour) === DEFAULT_GUARDRAILS.maxRequestsPerHour &&
    Number(maxRequestsPerDay) === DEFAULT_GUARDRAILS.maxRequestsPerDay &&
    Number(cooldownMinutes) === DEFAULT_GUARDRAILS.cooldownMinutes;

  function handleRestoreDefaults() {
    setMinJitterMs(DEFAULT_GUARDRAILS.minJitterMs);
    setMaxJitterMs(DEFAULT_GUARDRAILS.maxJitterMs);
    setSettleDelayMs(DEFAULT_GUARDRAILS.settleDelayMs);
    setMaxRequestsPerHour(DEFAULT_GUARDRAILS.maxRequestsPerHour);
    setMaxRequestsPerDay(DEFAULT_GUARDRAILS.maxRequestsPerDay);
    setCooldownMinutes(DEFAULT_GUARDRAILS.cooldownMinutes);
    setFeedback({
      type: 'success',
      text: 'Default guardrail values loaded. Click Save Guardrails to apply.',
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const body: Record<string, unknown> = {
        minJitterMs: Number(minJitterMs),
        maxJitterMs: Number(maxJitterMs),
        settleDelayMs: Number(settleDelayMs),
        maxRequestsPerHour: Number(maxRequestsPerHour),
        maxRequestsPerDay: Number(maxRequestsPerDay),
        cooldownMinutes: Number(cooldownMinutes),
      };

      if (clearProxy) {
        body.proxyUrl = '';
      } else if (proxyInput.trim() !== '') {
        body.proxyUrl = proxyInput.trim();
      }

      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
        body.confirmNewPassword = confirmNewPassword;
      }

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: 'error',
          text: data.error ?? 'Failed to update settings.',
        });
        return;
      }

      setProxyInput('');
      setClearProxy(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      onSettingsUpdated(data.settings);
      setFeedback({ type: 'success', text: 'Guardrails saved.' });
    } catch {
      setFeedback({ type: 'error', text: 'Network error saving settings.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-gunmetal-card border border-gunmetal-border rounded-lg shadow-sm p-4 sm:p-5 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-slate-300" />
          <h2 className="text-sm font-bold text-slate-200">
            Scraper Guardrails & Proxy
          </h2>
        </div>

        <Tooltip
          content="Executes one Chromium scrape at a time in arrival order to prevent bot detection"
          position="top"
        >
          <span
            tabIndex={0}
            className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-md bg-gunmetal-canvas border border-gunmetal-border text-gunmetal-muted cursor-help"
          >
            <span>Serial FIFO Queue (Concurrency = 1)</span>
            <Info className="h-3 w-3 text-slate-400 flex-shrink-0" />
          </span>
        </Tooltip>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <div className="mb-1">
              <Tooltip
                content="Minimum randomized delay (ms) before navigating to Google Flights (Default: 4000ms)"
                position="top"
              >
                <label
                  tabIndex={0}
                  className="inline-flex items-center gap-1 text-gunmetal-muted cursor-help"
                >
                  <span>Min Jitter (ms)</span>
                  <Info className="h-3 w-3 text-slate-500 flex-shrink-0" />
                </label>
              </Tooltip>
            </div>
            <input
              type="number"
              min={500}
              max={60000}
              required
              value={minJitterMs}
              onChange={(e) => setMinJitterMs(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 font-mono"
            />
          </div>

          <div>
            <div className="mb-1">
              <Tooltip
                content="Maximum randomized delay (ms) before navigating to Google Flights (Default: 9000ms)"
                position="top"
              >
                <label
                  tabIndex={0}
                  className="inline-flex items-center gap-1 text-gunmetal-muted cursor-help"
                >
                  <span>Max Jitter (ms)</span>
                  <Info className="h-3 w-3 text-slate-500 flex-shrink-0" />
                </label>
              </Tooltip>
            </div>
            <input
              type="number"
              min={500}
              max={120000}
              required
              value={maxJitterMs}
              onChange={(e) => setMaxJitterMs(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 font-mono"
            />
          </div>

          <div>
            <div className="mb-1">
              <Tooltip
                content="Wait time (ms) after page load for dynamic flight prices to render (Default: 2500ms)"
                position="top"
              >
                <label
                  tabIndex={0}
                  className="inline-flex items-center gap-1 text-gunmetal-muted cursor-help"
                >
                  <span>Settle Delay (ms)</span>
                  <Info className="h-3 w-3 text-slate-500 flex-shrink-0" />
                </label>
              </Tooltip>
            </div>
            <input
              type="number"
              min={500}
              max={30000}
              required
              value={settleDelayMs}
              onChange={(e) => setSettleDelayMs(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 font-mono"
            />
          </div>

          <div>
            <div className="mb-1">
              <Tooltip
                content="Maximum allowed scrape requests per rolling 60-minute window (Default: 20)"
                position="top"
              >
                <label
                  tabIndex={0}
                  className="inline-flex items-center gap-1 text-gunmetal-muted cursor-help"
                >
                  <span>Hourly Cap</span>
                  <Info className="h-3 w-3 text-slate-500 flex-shrink-0" />
                </label>
              </Tooltip>
            </div>
            <input
              type="number"
              min={1}
              max={500}
              required
              value={maxRequestsPerHour}
              onChange={(e) => setMaxRequestsPerHour(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 font-mono"
            />
          </div>

          <div>
            <div className="mb-1">
              <Tooltip
                content="Maximum allowed scrape requests per rolling 24-hour window (Default: 150)"
                position="top"
              >
                <label
                  tabIndex={0}
                  className="inline-flex items-center gap-1 text-gunmetal-muted cursor-help"
                >
                  <span>Daily Cap</span>
                  <Info className="h-3 w-3 text-slate-500 flex-shrink-0" />
                </label>
              </Tooltip>
            </div>
            <input
              type="number"
              min={1}
              max={5000}
              required
              value={maxRequestsPerDay}
              onChange={(e) => setMaxRequestsPerDay(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 font-mono"
            />
          </div>

          <div>
            <div className="mb-1">
              <Tooltip
                content="Pause duration (minutes) when Google triggers a CAPTCHA or 429 block (Default: 60m)"
                position="top"
              >
                <label
                  tabIndex={0}
                  className="inline-flex items-center gap-1 text-gunmetal-muted cursor-help"
                >
                  <span>Cooldown (min)</span>
                  <Info className="h-3 w-3 text-slate-500 flex-shrink-0" />
                </label>
              </Tooltip>
            </div>
            <input
              type="number"
              min={1}
              max={1440}
              required
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 font-mono"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-gunmetal-border/70">
          <div className="flex items-center justify-between mb-1">
            <Tooltip
              content="Optional HTTP, HTTPS, or SOCKS5 proxy routed for all Chromium requests"
              position="top"
            >
              <label
                tabIndex={0}
                className="inline-flex items-center gap-1 text-gunmetal-muted cursor-help"
              >
                <span>Outbound Proxy URL (optional)</span>
                <Info className="h-3 w-3 text-slate-500 flex-shrink-0" />
              </label>
            </Tooltip>
            {settings.hasProxy && (
              <Tooltip
                content="Credentials are masked at rest; enter a new URL to replace"
                position="top"
              >
                <span
                  tabIndex={0}
                  className="font-mono text-emerald-300 cursor-help"
                >
                  Active: {settings.maskedProxyUrl}
                </span>
              </Tooltip>
            )}
          </div>
          <input
            type="text"
            value={proxyInput}
            disabled={clearProxy}
            onChange={(e) => setProxyInput(e.target.value)}
            placeholder={
              settings.hasProxy
                ? 'Enter new proxy URL to replace existing...'
                : 'http://user:pass@proxy.example.com:8080'
            }
            className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 font-mono placeholder-zinc-600 disabled:opacity-40"
          />
          {settings.hasProxy && (
            <div className="mt-1.5">
              <Tooltip
                content="Clears the saved outbound proxy and reverts to direct connections on save"
                position="top"
              >
                <label className="inline-flex items-center gap-1.5 text-gunmetal-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearProxy}
                    onChange={(e) => setClearProxy(e.target.checked)}
                    className="rounded border-gunmetal-border bg-gunmetal-canvas"
                  />
                  <span>Remove configured proxy on save</span>
                </label>
              </Tooltip>
            </div>
          )}
        </div>

        <details className="pt-2 border-t border-gunmetal-border/70">
          <summary className="cursor-pointer text-slate-300 font-medium select-none">
            <Tooltip
              content="Rotate the console administrator password and invalidate existing sessions"
              position="top"
            >
              <span className="inline-flex items-center gap-1">
                <span>Change Admin Password</span>
                <Info className="h-3 w-3 text-slate-500 flex-shrink-0" />
              </span>
            </Tooltip>
          </summary>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 placeholder-zinc-600"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8)"
              className="px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 placeholder-zinc-600"
            />
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Confirm new password"
              className="px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 placeholder-zinc-600"
            />
          </div>
        </details>

        {feedback && (
          <div
            className={`rounded-lg px-3 py-2 border ${
              feedback.type === 'success'
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                : 'text-red-300 bg-red-500/10 border-red-500/30'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <Tooltip
            content="Persist updated guardrail and proxy settings to SQLite"
            position="top"
          >
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium bg-slate-100 text-zinc-950 hover:bg-white disabled:opacity-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save Guardrails'}
            </button>
          </Tooltip>

          <Tooltip
            content="Reset jitter, settle delay, rate caps, and cooldown to recommended defaults"
            position="top"
          >
            <button
              type="button"
              onClick={handleRestoreDefaults}
              disabled={saving || isAlreadyDefault}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium bg-gunmetal-canvas hover:bg-zinc-800 border border-gunmetal-border text-slate-200 disabled:opacity-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore Defaults
            </button>
          </Tooltip>
        </div>
      </form>
    </section>
  );
}