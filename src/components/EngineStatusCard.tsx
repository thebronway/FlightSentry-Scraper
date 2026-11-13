'use client';

import { useState } from 'react';
import { Activity, AlertTriangle, RotateCcw } from 'lucide-react';
import type { PublicScraperSettings, UsageQuotaStats } from '@/types';

interface EngineStatusCardProps {
  settings: PublicScraperSettings;
  usage: UsageQuotaStats;
  onSettingsUpdated: (settings: PublicScraperSettings) => void;
}

export function EngineStatusCard({
  settings,
  usage,
  onSettingsUpdated,
}: EngineStatusCardProps) {
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hourlyPct = Math.min(
    100,
    Math.round((usage.hourlyUsed / Math.max(1, settings.maxRequestsPerHour)) * 100)
  );
  const dailyPct = Math.min(
    100,
    Math.round((usage.dailyUsed / Math.max(1, settings.maxRequestsPerDay)) * 100)
  );

  const hourlyBarColor = settings.circuitBreakerActive
    ? 'bg-amber-600'
    : hourlyPct >= 90
      ? 'bg-red-500'
      : hourlyPct >= 75
        ? 'bg-yellow-400'
        : 'bg-sky-500';

  const hourlyUsedColor = settings.circuitBreakerActive
    ? 'text-slate-200'
    : hourlyPct >= 90
      ? 'text-red-400'
      : hourlyPct >= 75
        ? 'text-yellow-300'
        : 'text-slate-200';

  const dailyBarColor = settings.circuitBreakerActive
    ? 'bg-amber-600'
    : dailyPct >= 90
      ? 'bg-red-500'
      : dailyPct >= 75
        ? 'bg-yellow-400'
        : 'bg-sky-500';

  const dailyUsedColor = settings.circuitBreakerActive
    ? 'text-slate-200'
    : dailyPct >= 90
      ? 'text-red-400'
      : dailyPct >= 75
        ? 'text-yellow-300'
        : 'text-slate-200';

  async function handleResetCooldown() {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/circuit-breaker', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to reset cooldown.');
        return;
      }
      onSettingsUpdated(data.settings);
    } catch {
      setError('Network error resetting cooldown.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="bg-gunmetal-card border border-gunmetal-border rounded-lg shadow-sm p-4 sm:p-5 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-300" />
          <h2 className="text-sm font-bold text-slate-200">
            Engine Status & Circuit Breaker
          </h2>
        </div>
      </div>

      {settings.circuitBreakerActive && (
        <div className="mb-4 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-amber-200">
                Circuit Breaker Active — Scraping Paused
              </p>
              <p className="text-amber-300/90 mt-0.5">
                {settings.circuitBreakerReason || 'Upstream rate limit detected.'}
                {settings.circuitBreakerUntil && (
                  <>
                    {' '}
                    Resumes at{' '}
                    <span className="underline">
                      {new Date(settings.circuitBreakerUntil).toLocaleString()}
                    </span>
                    .
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetCooldown}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-400 text-zinc-950 hover:bg-amber-300 disabled:opacity-50 shrink-0 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {resetting ? 'Resetting...' : 'Reset Cooldown'}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-3.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border">
          <div className="text-xs text-gunmetal-muted">Chromium Engine</div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-100">
              {settings.circuitBreakerActive ? 'Cooldown' : 'Ready'}
            </span>
            <span className="text-xs text-gunmetal-muted">
              {settings.hasProxy ? 'Proxy On' : 'Direct'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gunmetal-muted">Rolling 1-Hour Quota</span>
            <span className="text-slate-200 font-medium">
              <span className={hourlyUsedColor}>{usage.hourlyUsed}</span> /{' '}
              {settings.maxRequestsPerHour}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-gunmetal-card border border-gunmetal-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${hourlyBarColor}`}
              style={{ width: `${hourlyPct}%` }}
            />
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gunmetal-muted">Rolling 24-Hour Quota</span>
            <span className="text-slate-200 font-medium">
              <span className={dailyUsedColor}>{usage.dailyUsed}</span> /{' '}
              {settings.maxRequestsPerDay}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-gunmetal-card border border-gunmetal-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${dailyBarColor}`}
              style={{ width: `${dailyPct}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}