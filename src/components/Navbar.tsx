'use client';

import { AlertOctagon, LogOut, PauseCircle, ShieldAlert, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  authenticated: boolean;
  globalPaused: boolean;
  circuitBreakerActive: boolean;
  rateLimited: boolean;
  onSignOut: () => Promise<void>;
}

export function Navbar({
  authenticated,
  globalPaused,
  circuitBreakerActive,
  rateLimited,
  onSignOut,
}: NavbarProps) {
  return (
    <header className="bg-gunmetal-nav shadow-sm border-b border-gunmetal-border h-16 sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center space-x-3 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-filled-sm.webp"
            alt="FlightSentry Logo"
            className="h-[42px] w-auto object-contain rounded"
          />
          <span className="font-bold text-xl tracking-tight">
            FlightSentry Scraper
          </span>
        </div>

        {authenticated && (
          <div className="flex items-center space-x-2 sm:space-x-4">
            {globalPaused ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-300">
                <PauseCircle className="w-4 h-4" />
                Paused
              </span>
            ) : circuitBreakerActive ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <ShieldAlert className="w-4 h-4" />
                Cooldown
              </span>
            ) : rateLimited ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-300">
                <AlertOctagon className="w-4 h-4" />
                Rate Limited
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                <ShieldCheck className="w-4 h-4" />
                Ready
              </span>
            )}

            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium bg-gunmetal-canvas hover:bg-gunmetal-card border border-gunmetal-border text-slate-200 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}