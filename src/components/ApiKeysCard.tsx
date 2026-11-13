'use client';

import { useState } from 'react';
import { Check, Copy, Key, Plus, Trash2 } from 'lucide-react';
import type { ApiKeyRecord } from '@/types';

interface ApiKeysCardProps {
  keys: ApiKeyRecord[];
  onRefresh: () => Promise<void>;
}

export function ApiKeysCard({ keys, onRefresh }: ApiKeysCardProps) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    setRevealedKey(null);

    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create API key.');
        return;
      }

      setName('');
      setRevealedKey(data.rawKey);
      setCopied(false);
      await onRefresh();
    } catch {
      setError('Network error creating API key.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: number) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/keys/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to revoke key.');
        return;
      }
      await onRefresh();
    } catch {
      setError('Network error revoking API key.');
    }
  }

  async function handleCopy() {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <section className="bg-gunmetal-card border border-gunmetal-border rounded-xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-slate-300" />
          <h2 className="text-sm font-semibold text-slate-100">API Keys</h2>
        </div>
        <span className="text-xs text-gunmetal-muted">SHA-256 Hashed</span>
      </div>

      <form onSubmit={handleCreateKey} className="flex gap-2 mb-4">
        <input
          type="text"
          required
          maxLength={64}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key label (e.g. FlightSentry Prod)"
          className="flex-1 px-3 py-2 text-xs rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 placeholder-zinc-600 focus:outline-none focus:border-slate-400"
        />
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 text-zinc-950 hover:bg-white disabled:opacity-50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {creating ? 'Minting...' : 'Mint Key'}
        </button>
      </form>

      {revealedKey && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-emerald-300">
              Copy this API key now — it will not be shown again
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy
                </>
              )}
            </button>
          </div>
          <code className="block text-xs text-emerald-100 break-all bg-gunmetal-canvas px-2.5 py-1.5 rounded border border-emerald-500/20">
            {revealedKey}
          </code>
        </div>
      )}

      {error && (
        <div className="mb-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        {keys.length === 0 ? (
          <p className="text-xs text-gunmetal-muted py-6 text-center border border-dashed border-gunmetal-border rounded-lg">
            No API keys minted yet. Create one to connect FlightSentry.
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gunmetal-border text-gunmetal-muted">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Prefix</th>
                <th className="pb-2 font-medium">Last Used</th>
                <th className="pb-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gunmetal-border/60">
              {keys.map((item) => {
                const isRevoked = Boolean(item.revokedAt);
                return (
                  <tr key={item.id} className={isRevoked ? 'opacity-50' : ''}>
                    <td className="py-2.5 pr-2 font-medium text-slate-200">
                      {item.name}
                    </td>
                    <td className="py-2.5 pr-2 text-gunmetal-muted">
                      <code>{item.keyPrefix}…</code>
                    </td>
                    <td className="py-2.5 pr-2 text-gunmetal-muted">
                      {item.lastUsedAt
                        ? new Date(item.lastUsedAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="py-2.5 text-right">
                      {isRevoked ? (
                        <span className="text-red-400">Revoked</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRevoke(item.id)}
                          className="inline-flex items-center gap-1 text-red-300 hover:text-red-200 px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3 w-3" />
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}