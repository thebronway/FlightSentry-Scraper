'use client';

import { useState } from 'react';
import { Plane, Play } from 'lucide-react';
import type { CabinClass, FareTier, ScrapeResponse } from '@/types';

interface LiveTestScrapeCardProps {
  onScrapeCompleted: () => Promise<void>;
}

function defaultFutureDate(): string {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return future.toISOString().slice(0, 10);
}

export function LiveTestScrapeCard({
  onScrapeCompleted,
}: LiveTestScrapeCardProps) {
  const [origin, setOrigin] = useState('WAS');
  const [destination, setDestination] = useState('SFO');
  const [departureDate, setDepartureDate] = useState(defaultFutureDate);
  const [cabinClass, setCabinClass] = useState<CabinClass>('economy');
  const [fareTier, setFareTier] = useState<FareTier>('Standard');
  const [currency, setCurrency] = useState('USD');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScrapeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRunTest(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/admin/test-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: origin.trim().toUpperCase(),
          destination: destination.trim().toUpperCase(),
          departureDate,
          cabinClass,
          fareTier,
          currency: currency.trim().toUpperCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok && !data.status) {
        setError(data.error ?? 'Test scrape failed.');
        return;
      }

      setResult(data as ScrapeResponse);
      await onScrapeCompleted();
    } catch {
      setError('Network error running test scrape.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="bg-gunmetal-card border border-gunmetal-border rounded-lg shadow-sm p-4 sm:p-5 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-slate-300" />
          <h2 className="text-sm font-bold text-slate-200">
            Live Test Scrape
          </h2>
        </div>
        <span className="text-xs text-gunmetal-muted">
          Headless Chromium Verification
        </span>
      </div>

      <form onSubmit={handleRunTest} className="space-y-3 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
          <div>
            <label className="block text-gunmetal-muted mb-1">Origin</label>
            <input
              type="text"
              required
              value={origin}
              onChange={(e) => setOrigin(e.target.value.toUpperCase())}
              placeholder="WAS"
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 uppercase"
            />
          </div>

          <div>
            <label className="block text-gunmetal-muted mb-1">
              Destination
            </label>
            <input
              type="text"
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value.toUpperCase())}
              placeholder="SFO"
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 uppercase"
            />
          </div>

          <div>
            <label className="block text-gunmetal-muted mb-1">Date</label>
            <input
              type="date"
              required
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100"
            />
          </div>

          <div>
            <label className="block text-gunmetal-muted mb-1">Cabin</label>
            <select
              value={cabinClass}
              onChange={(e) => setCabinClass(e.target.value as CabinClass)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100"
            >
              <option value="economy">Economy</option>
              <option value="premium_economy">Premium Econ</option>
              <option value="business">Business</option>
              <option value="first">First</option>
            </select>
          </div>

          <div>
            <label className="block text-gunmetal-muted mb-1">Fare Tier</label>
            <select
              value={fareTier}
              onChange={(e) => setFareTier(e.target.value as FareTier)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100"
            >
              <option value="Standard">Standard</option>
              <option value="Basic">Basic</option>
            </select>
          </div>

          <div>
            <label className="block text-gunmetal-muted mb-1">Currency</label>
            <input
              type="text"
              maxLength={3}
              required
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 uppercase"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={running}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium bg-slate-100 text-zinc-950 hover:bg-white disabled:opacity-50 transition-colors"
        >
          <Play className="h-3.5 w-3.5" />
          {running ? 'Scraping Google Flights...' : 'Run Live Scrape'}
        </button>
      </form>

      {error && (
        <div className="mt-4 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-3.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100">
                Status: {result.status}
              </span>
              {result.price !== null && (
                <span className="text-emerald-300 font-semibold">
                  Lowest: {result.currency} {result.price}
                </span>
              )}
            </div>
            <span className="text-gunmetal-muted">
              {result.itineraries.length} itineraries • {result.meta.durationMs}ms
            </span>
          </div>

          {result.errorMessage && (
            <p className="text-red-300">{result.errorMessage}</p>
          )}

          {result.itineraries.length > 0 && (
            <div className="max-h-56 overflow-y-auto divide-y divide-gunmetal-border/70 border border-gunmetal-border rounded-lg">
              {result.itineraries.slice(0, 10).map((itin, idx) => (
                <div
                  key={`${itin.airline}-${itin.flightNumber}-${idx}`}
                  className="px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-semibold text-slate-100">
                      {itin.airline} {itin.flightNumber}
                    </span>{' '}
                    <span className="text-gunmetal-muted">
                      ({itin.origin} → {itin.destination})
                    </span>
                    <div className="text-gunmetal-muted mt-0.5">
                      {itin.departureTime} → {itin.arrivalTime} • {itin.duration} •{' '}
                      {itin.isNonstop
                        ? 'Nonstop'
                        : `${itin.stops} stop${itin.stops > 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <div className="font-semibold text-emerald-300 shrink-0">
                    {result.currency} {itin.price}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}