'use client';

import { useEffect, useState } from 'react';
import { Save, Sliders } from 'lucide-react';
import type { PublicScraperSettings } from '@/types';

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
    <section className="bg-gunmetal-card border border-gunmetal-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-slate-300" />
          <h2 className="text-sm font-semibold text-slate-100">
            Scraper Guardrails & Proxy
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-gunmetal-muted mb-1">
              Min Jitter (ms)
            </label>
            <input
              type="number"
              min={500}
              max={60000}
              required
              value={minJitterMs}
              onChange={(e) => setMinJitterMs(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100"
            />
          </div>

          <div>
            <label className="block text-gunmetal-muted mb-1">
              Max Jitter (ms)
            </label>
            <input
              type="number"
              min={500}
              max={120000}
              required
              value={maxJitterMs}
              onChange={(e) => setMaxJitterMs(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100"
            />
          </div>

          <div>
            <label className="block text-gunmetal-muted mb-1">
              Settle Delay (ms)
            </label>
            <input
              type="number"
              min={500}
              max={30000}
              required
              value={settleDelayMs}
              onChange={(e) => setSettleDelayMs(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100"
            />
          </div>

          <div>
            <label className="block text-gunmetal-muted mb-1">
              Hourly Cap
            </label>
            <input
              type="number"
              min={1}
              max={500}
              required
              value={maxRequestsPerHour}
              onChange={(e) => setMaxRequestsPerHour(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100"
            />
          </div>

          <div>
            <label className="block text-gunmetal-muted mb-1">Daily Cap</label>
            <input
              type="number"
              min={1}
              max={5000}
              required
              value={maxRequestsPerDay}
              onChange={(e) => setMaxRequestsPerDay(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100"
            />
          </div>

          <div>
            <label className="block text-gunmetal-muted mb-1">
              Cooldown (min)
            </label>
            <input
              type="number"
              min={1}
              max={1440}
              required
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-gunmetal-border/70">
          <div className="flex items-center justify-between mb-1">
            <label className="text-gunmetal-muted">
              Outbound Proxy URL (optional)
            </label>
            {settings.hasProxy && (
              <span className="text-emerald-300">
                Active: {settings.maskedProxyUrl}
              </span>
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
            className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 placeholder-zinc-600 disabled:opacity-40"
          />
          {settings.hasProxy && (
            <label className="mt-1.5 inline-flex items-center gap-1.5 text-gunmetal-muted cursor-pointer">
              <input
                type="checkbox"
                checked={clearProxy}
                onChange={(e) => setClearProxy(e.target.checked)}
                className="rounded border-gunmetal-border bg-gunmetal-canvas"
              />
              Remove configured proxy on save
            </label>
          )}
        </div>

        <details className="pt-2 border-t border-gunmetal-border/70">
          <summary className="cursor-pointer text-slate-300 font-medium select-none">
            Change Admin Password
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

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium bg-slate-100 text-zinc-950 hover:bg-white disabled:opacity-50 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save Guardrails'}
        </button>
      </form>
    </section>
  );
}