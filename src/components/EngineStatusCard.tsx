'use client';

import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Pause,
  PauseCircle,
  Play,
  RotateCcw,
} from 'lucide-react';
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
  const [togglingPause, setTogglingPause] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hourlyPct = Math.min(
    100,
    Math.round((usage.hourlyUsed / Math.max(1, settings.maxRequestsPerHour)) * 100)
  );
  const dailyPct = Math.min(
    100,
    Math.round((usage.dailyUsed / Math.max(1, settings.maxRequestsPerDay)) * 100)
  );
  const isRateLimited =
    !settings.globalPaused &&
    !settings.circuitBreakerActive &&
    (usage.hourlyUsed >= settings.maxRequestsPerHour ||
      usage.dailyUsed >= settings.maxRequestsPerDay);

  const engineStatusLabel = settings.globalPaused
    ? 'Paused'
    : settings.circuitBreakerActive
      ? 'Cooldown'
      : isRateLimited
        ? 'Rate Limited'
        : 'Ready';

  const engineCardBorder = settings.globalPaused
    ? 'border-orange-500/40'
    : settings.circuitBreakerActive
      ? 'border-amber-500/40'
      : isRateLimited
        ? 'border-red-500/40'
        : 'border-emerald-500/30';

  const engineStatusDotColor = settings.globalPaused
    ? 'bg-orange-400'
    : settings.circuitBreakerActive
      ? 'bg-amber-400'
      : isRateLimited
        ? 'bg-red-400'
        : 'bg-emerald-400';

  const engineStatusTextColor = settings.globalPaused
    ? 'text-orange-400'
    : settings.circuitBreakerActive
      ? 'text-amber-300'
      : isRateLimited
        ? 'text-red-400'
        : 'text-emerald-300';

  const hourlyBarColor = settings.globalPaused
    ? 'bg-orange-500'
    : settings.circuitBreakerActive
      ? 'bg-amber-600'
      : hourlyPct >= 90
        ? 'bg-red-500'
        : hourlyPct >= 75
          ? 'bg-yellow-400'
          : 'bg-sky-500';

  const hourlyUsedColor = settings.globalPaused
    ? 'text-orange-400'
    : settings.circuitBreakerActive
      ? 'text-slate-200'
      : hourlyPct >= 90
        ? 'text-red-400'
        : hourlyPct >= 75
          ? 'text-yellow-300'
          : 'text-slate-200';

  const dailyBarColor = settings.globalPaused
    ? 'bg-orange-500'
    : settings.circuitBreakerActive
      ? 'bg-amber-600'
      : dailyPct >= 90
        ? 'bg-red-500'
        : dailyPct >= 75
          ? 'bg-yellow-400'
          : 'bg-sky-500';

  const dailyUsedColor = settings.globalPaused
    ? 'text-orange-400'
    : settings.circuitBreakerActive
      ? 'text-slate-200'
      : dailyPct >= 90
        ? 'text-red-400'
        : dailyPct >= 75
          ? 'text-yellow-300'
          : 'text-slate-200';

  async function handleToggleGlobalPause() {
    setTogglingPause(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: !settings.globalPaused }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to update global pause state.');
        return;
      }
      onSettingsUpdated(data.settings);
    } catch {
      setError('Network error updating global pause state.');
    } finally {
      setTogglingPause(false);
    }
  }

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
    <section
      className={`bg-gunmetal-card border rounded-lg shadow-sm p-4 sm:p-5 transition-colors ${
        settings.globalPaused
          ? 'border-orange-500/40'
          : 'border-gunmetal-border'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <Activity
            className={`h-4 w-4 ${
              settings.globalPaused ? 'text-orange-400' : 'text-slate-300'
            }`}
          />
          <h2 className="text-sm font-bold text-slate-200">
            Engine Status & Circuit Breaker
          </h2>
        </div>

        <button
          type="button"
          onClick={handleToggleGlobalPause}
          disabled={togglingPause}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50 transition-colors ${
            settings.globalPaused
              ? 'bg-orange-500 border-orange-400 text-zinc-950 hover:bg-orange-400'
              : 'bg-gunmetal-canvas border-gunmetal-border text-slate-200 hover:bg-zinc-800'
          }`}
        >
          {settings.globalPaused ? (
            <>
              <Play className="h-3.5 w-3.5" />
              {togglingPause ? 'Resuming...' : 'Resume Scraping'}
            </>
          ) : (
            <>
              <Pause className="h-3.5 w-3.5" />
              {togglingPause ? 'Pausing...' : 'Pause Scraper'}
            </>
          )}
        </button>
      </div>

      {settings.globalPaused && (
        <div className="mb-4 p-3.5 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-start gap-2.5">
          <PauseCircle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-orange-200">
              Global Pause Active — All Scraping Halted
            </p>
            <p className="text-orange-300/90 mt-0.5">
              Incoming API and test scrapes are paused (HTTP 503) without
              consuming rolling quota.
              {settings.globalPausedAt && (
                <>
                  {' '}
                  Paused since{' '}
                  <span className="underline">
                    {new Date(settings.globalPausedAt).toLocaleString()}
                  </span>
                  .
                </>
              )}
            </p>
          </div>
        </div>
      )}

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
        <div
          className={`p-3.5 rounded-lg bg-gunmetal-canvas border transition-colors ${engineCardBorder}`}
        >
          <div className="text-xs text-gunmetal-muted">Chromium Engine</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-2 text-sm font-semibold ${engineStatusTextColor}`}
            >
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${engineStatusDotColor}`}
              />
              {engineStatusLabel}
            </span>
            {settings.hasProxy && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/10 border border-sky-500/30 text-sky-300">
                Proxy On
              </span>
            )}
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