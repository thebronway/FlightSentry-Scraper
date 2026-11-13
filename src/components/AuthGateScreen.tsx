'use client';

import { useState } from 'react';
import { KeyRound, Lock, Shield } from 'lucide-react';
import type { PublicScraperSettings } from '@/types';

interface AuthGateScreenProps {
  hasAdminPassword: boolean;
  onAuthenticated: (settings: PublicScraperSettings) => void;
}

export function AuthGateScreen({
  hasAdminPassword,
  onAuthenticated,
}: AuthGateScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSetup = !hasAdminPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = isSetup
        ? { action: 'setup', password, confirmPassword }
        : { action: 'login', password };

      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Authentication failed.');
        return;
      }

      setPassword('');
      setConfirmPassword('');
      onAuthenticated(data.settings);
    } catch {
      setError('Unable to reach scraper server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-gunmetal-card border border-gunmetal-border rounded-xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-gunmetal-canvas border border-gunmetal-border flex items-center justify-center text-slate-200">
            {isSetup ? (
              <Shield className="h-5 w-5 text-emerald-400" />
            ) : (
              <Lock className="h-5 w-5 text-slate-300" />
            )}
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-100">
              {isSetup
                ? 'Initial Setup — Set Admin Password'
                : 'Admin Console Sign In'}
            </h1>
            <p className="text-xs text-gunmetal-muted">
              {isSetup
                ? 'Secure this scraper instance before generating API keys.'
                : 'Enter your administrator password to manage keys and guardrails.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              {isSetup ? 'New Admin Password (min 8 chars)' : 'Admin Password'}
            </label>
            <div className="relative">
              <KeyRound className="h-4 w-4 text-gunmetal-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="admin-password"
                type="password"
                required
                minLength={isSetup ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 placeholder-zinc-600 focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>

          {isSetup && (
            <div>
              <label
                htmlFor="confirm-admin-password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Confirm Admin Password
              </label>
              <div className="relative">
                <KeyRound className="h-4 w-4 text-gunmetal-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="confirm-admin-password"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 placeholder-zinc-600 focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-slate-100 text-zinc-950 hover:bg-white disabled:opacity-50 transition-colors"
          >
            {submitting
              ? 'Verifying...'
              : isSetup
                ? 'Save Password & Unlock Console'
                : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}