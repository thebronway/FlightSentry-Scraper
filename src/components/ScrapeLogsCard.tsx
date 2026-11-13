'use client';

import { RefreshCw, Terminal } from 'lucide-react';
import type { ScrapeLogEntry, ScrapeStatus } from '@/types';

interface ScrapeLogsCardProps {
  logs: ScrapeLogEntry[];
  onRefresh: () => Promise<void>;
}

function badgeStyle(status: ScrapeStatus): string {
  switch (status) {
    case 'Success':
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
    case 'RateLimited':
      return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    case 'SoldOut':
      return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
    case 'Error':
      return 'bg-red-500/10 text-red-300 border-red-500/30';
  }
}

export function ScrapeLogsCard({ logs, onRefresh }: ScrapeLogsCardProps) {
  return (
    <section className="bg-gunmetal-card border border-gunmetal-border rounded-lg shadow-sm p-4 sm:p-5 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-slate-300" />
          <h2 className="text-sm font-bold text-slate-200">
            Recent Scrape Logs
          </h2>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gunmetal-canvas hover:bg-zinc-800 border border-gunmetal-border text-slate-300 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-gunmetal-muted py-6 text-center border border-dashed border-gunmetal-border rounded-lg">
          No scrape requests logged yet.
        </p>
      ) : (
        <div className="max-h-80 overflow-y-auto overflow-x-auto border border-gunmetal-border rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-gunmetal-canvas sticky top-0 border-b border-gunmetal-border text-gunmetal-muted">
              <tr>
                <th className="py-2 px-3 font-medium">Time</th>
                <th className="py-2 px-3 font-medium">Route</th>
                <th className="py-2 px-3 font-medium">Date / Cabin</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium">Result</th>
                <th className="py-2 px-3 font-medium text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gunmetal-border/60">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gunmetal-canvas/60">
                  <td className="py-2 px-3 text-gunmetal-muted whitespace-nowrap">
                    {new Date(log.queriedAt).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-100 whitespace-nowrap">
                    {log.route}
                    {log.flightNumber ? ` (${log.flightNumber})` : ''}
                  </td>
                  <td className="py-2 px-3 text-gunmetal-muted whitespace-nowrap">
                    {log.departureDate} • {log.cabinClass} ({log.fareTier})
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${badgeStyle(
                        log.status
                      )}`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-300">
                    {log.status === 'Success' && log.lowestPrice !== null
                      ? `${log.currency ?? ''} ${log.lowestPrice} (${log.itineraryCount} flights)`
                      : log.errorMessage || `${log.itineraryCount} flights`}
                  </td>
                  <td className="py-2 px-3 text-right text-gunmetal-muted whitespace-nowrap">
                    {log.durationMs}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}