'use client';

import { useEffect, useState } from 'react';
import { Info, RotateCcw, Save, Sliders } from 'lucide-react';
import Tooltip from '@/components/common/Tooltip';
import type { PublicScraperSettings } from '@/types';
import { AdminPasswordSection } from './guardrails/AdminPasswordSection';
import { GuardrailLimitsGrid } from './guardrails/GuardrailLimitsGrid';
import {
  DEFAULT_GUARDRAILS,
  type GuardrailValues,
} from './guardrails/guardrailsConfig';
import { OutboundProxySection } from './guardrails/OutboundProxySection';

interface GuardrailsSettingsCardProps {
  settings: PublicScraperSettings;
  onSettingsUpdated: (settings: PublicScraperSettings) => void;
}

function extractGuardrails(settings: PublicScraperSettings): GuardrailValues {
  return {
    minJitterMs: settings.minJitterMs,
    maxJitterMs: settings.maxJitterMs,
    settleDelayMs: settings.settleDelayMs,
    maxRequestsPerHour: settings.maxRequestsPerHour,
    maxRequestsPerDay: settings.maxRequestsPerDay,
    cooldownMinutes: settings.cooldownMinutes,
  };
}

export function GuardrailsSettingsCard({
  settings,
  onSettingsUpdated,
}: GuardrailsSettingsCardProps) {
  const [values, setValues] = useState<GuardrailValues>(() =>
    extractGuardrails(settings)
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
    setValues(extractGuardrails(settings));
  }, [settings]);

  const isAlreadyDefault = (
    Object.keys(DEFAULT_GUARDRAILS) as Array<keyof GuardrailValues>
  ).every((key) => Number(values[key]) === DEFAULT_GUARDRAILS[key]);

  function handleFieldChange(key: keyof GuardrailValues, nextValue: number) {
    setValues((prev) => ({ ...prev, [key]: nextValue }));
  }

  function handleRestoreDefaults() {
    setValues({ ...DEFAULT_GUARDRAILS });
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
        minJitterMs: Number(values.minJitterMs),
        maxJitterMs: Number(values.maxJitterMs),
        settleDelayMs: Number(values.settleDelayMs),
        maxRequestsPerHour: Number(values.maxRequestsPerHour),
        maxRequestsPerDay: Number(values.maxRequestsPerDay),
        cooldownMinutes: Number(values.cooldownMinutes),
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
        <GuardrailLimitsGrid values={values} onChange={handleFieldChange} />

        <OutboundProxySection
          hasProxy={settings.hasProxy}
          maskedProxyUrl={settings.maskedProxyUrl}
          proxyInput={proxyInput}
          clearProxy={clearProxy}
          onProxyInputChange={setProxyInput}
          onClearProxyChange={setClearProxy}
        />

        <AdminPasswordSection
          currentPassword={currentPassword}
          newPassword={newPassword}
          confirmNewPassword={confirmNewPassword}
          onCurrentPasswordChange={setCurrentPassword}
          onNewPasswordChange={setNewPassword}
          onConfirmNewPasswordChange={setConfirmNewPassword}
        />

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