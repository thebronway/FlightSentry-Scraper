'use client';

import { LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  authenticated: boolean;
  circuitBreakerActive: boolean;
  onSignOut: () => Promise<void>;
}

export function Navbar({
  authenticated,
  circuitBreakerActive,
  onSignOut,
}: NavbarProps) {
  return (
    <header className="bg-gunmetal-nav border-b border-gunmetal-border h-16 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-filled-sm.webp"
            alt="FlightSentry Logo"
            className="h-8 w-8 rounded-md object-contain"
          />
          <div className="flex items-center gap-2.5">
            <span className="text-sm sm:text-base font-semibold tracking-tight text-slate-100">
              FlightSentry Scraper
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-gunmetal-canvas border border-gunmetal-border text-gunmetal-muted">
              v0.1.0
            </span>
          </div>
        </div>

        {authenticated && (
          <div className="flex items-center gap-3">
            {circuitBreakerActive ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <ShieldAlert className="h-3.5 w-3.5" />
                Cooldown
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Ready
              </span>
            )}

            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gunmetal-canvas hover:bg-zinc-800 border border-gunmetal-border text-slate-200 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}