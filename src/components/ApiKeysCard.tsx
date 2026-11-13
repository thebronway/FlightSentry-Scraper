'use client';

import { useEffect, useRef, useState } from 'react';
import { Ban, Check, Copy, Key, Plus, Trash2 } from 'lucide-react';
import Tooltip from '@/components/common/Tooltip';
import type { ApiKeyRecord } from '@/types';

interface ApiKeysCardProps {
  keys: ApiKeyRecord[];
  onRefresh: () => Promise<void>;
}

function fallbackCopyText(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let succeeded = false;
  try {
    succeeded = document.execCommand('copy');
  } catch {
    succeeded = false;
  } finally {
    document.body.removeChild(textarea);
  }
  return succeeded;
}

export function ApiKeysCard({ keys, onRefresh }: ApiKeysCardProps) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [busyKeyId, setBusyKeyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (revealedKey && keyInputRef.current) {
      keyInputRef.current.focus();
      keyInputRef.current.select();
      keyInputRef.current.setSelectionRange(0, revealedKey.length);
    }
  }, [revealedKey]);

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
    setBusyKeyId(id);
    try {
      const res = await fetch(`/api/admin/keys/${id}`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to revoke key.');
        return;
      }
      setConfirmDeleteId(null);
      await onRefresh();
    } catch {
      setError('Network error revoking API key.');
    } finally {
      setBusyKeyId(null);
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    setBusyKeyId(id);
    try {
      const res = await fetch(`/api/admin/keys/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to delete revoked key.');
        return;
      }
      setConfirmDeleteId(null);
      await onRefresh();
    } catch {
      setError('Network error deleting revoked API key.');
    } finally {
      setBusyKeyId(null);
    }
  }

  async function handleCopy() {
    if (!revealedKey) return;

    let ok = false;
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      window.isSecureContext
    ) {
      try {
        await navigator.clipboard.writeText(revealedKey);
        ok = true;
      } catch {
        ok = fallbackCopyText(revealedKey);
      }
    } else {
      ok = fallbackCopyText(revealedKey);
    }

    if (keyInputRef.current) {
      keyInputRef.current.focus();
      keyInputRef.current.select();
      keyInputRef.current.setSelectionRange(0, revealedKey.length);
    }

    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setError('Clipboard access was blocked. Press Ctrl+C / Cmd+C while the key is highlighted.');
    }
  }

  return (
    <section className="bg-gunmetal-card border border-gunmetal-border rounded-lg shadow-sm p-4 sm:p-5 flex flex-col transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-slate-300" />
          <h2 className="text-sm font-bold text-slate-200">API Keys</h2>
        </div>
        <span className="text-xs font-mono text-gunmetal-muted">SHA-256 Hashed</span>
      </div>

      <form onSubmit={handleCreateKey} className="flex gap-2 mb-4 max-w-xl">
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
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-semibold text-emerald-300">
              Copy this API key now — it will not be shown again
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 transition-colors"
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
              <button
                type="button"
                onClick={() => setRevealedKey(null)}
                className="text-xs px-2 py-1 rounded bg-gunmetal-canvas/70 hover:bg-gunmetal-canvas text-slate-300 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
          <input
            ref={keyInputRef}
            type="text"
            readOnly
            value={revealedKey}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.currentTarget.select()}
            aria-label="Generated API key"
            className="w-full font-mono text-xs text-emerald-100 bg-gunmetal-canvas px-2.5 py-1.5 rounded border border-emerald-500/30 focus:outline-none focus:border-emerald-400 selection:bg-emerald-400/30 selection:text-white"
          />
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
                <th className="pb-2.5 pr-4 font-medium">Name</th>
                <th className="pb-2.5 pr-4 font-medium">Prefix</th>
                <th className="pb-2.5 pr-4 font-medium">Usage</th>
                <th className="pb-2.5 pr-4 font-medium">Created</th>
                <th className="pb-2.5 pr-4 font-medium">Last Used</th>
                <th className="pb-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gunmetal-border/60">
              {keys.map((item) => {
                const isRevoked = Boolean(item.revokedAt);
                const usage = item.usage ?? { last1h: 0, last24h: 0, total: 0 };
                const isConfirmingDelete = confirmDeleteId === item.id;
                const isBusy = busyKeyId === item.id;

                return (
                  <tr key={item.id} className="hover:bg-gunmetal-canvas/40">
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <span
                          className={`font-medium ${
                            isRevoked ? 'text-slate-400' : 'text-slate-200'
                          }`}
                        >
                          {item.name}
                        </span>
                        {isRevoked ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 border border-red-500/30 text-red-300">
                            Revoked
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                            Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gunmetal-muted whitespace-nowrap">
                      <code className="px-2 py-0.5 rounded bg-gunmetal-canvas border border-gunmetal-border/70">
                        {item.keyPrefix}…
                      </code>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <Tooltip
                        content={`Last 1h: ${usage.last1h} · Last 24h: ${usage.last24h} · All-time total: ${usage.total}`}
                        position="top"
                      >
                        <div className="inline-flex items-center gap-1.5 font-mono cursor-help">
                          <span className="px-2 py-0.5 rounded bg-gunmetal-canvas border border-gunmetal-border/70 text-slate-300">
                            <span className="text-gunmetal-muted">1h:</span>{' '}
                            {usage.last1h}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-gunmetal-canvas border border-gunmetal-border/70 text-slate-300">
                            <span className="text-gunmetal-muted">24h:</span>{' '}
                            {usage.last24h}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-gunmetal-canvas border border-gunmetal-border/70 text-slate-100 font-semibold">
                            <span className="text-gunmetal-muted font-normal">
                              Total:
                            </span>{' '}
                            {usage.total}
                          </span>
                        </div>
                      </Tooltip>
                    </td>
                    <td className="py-3 pr-4 text-gunmetal-muted whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4 text-gunmetal-muted whitespace-nowrap">
                      {item.lastUsedAt
                        ? new Date(item.lastUsedAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {!isRevoked ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleRevoke(item.id)}
                          className="inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200 px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                        >
                          <Ban className="h-3 w-3" />
                          Revoke
                        </button>
                      ) : isConfirmingDelete ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDelete(item.id)}
                            className="inline-flex items-center gap-1 text-red-200 bg-red-600/40 hover:bg-red-600/60 px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-slate-300 hover:text-white px-2.5 py-1 rounded bg-gunmetal-canvas border border-gunmetal-border transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="inline-flex items-center gap-1.5 text-red-300 hover:text-red-200 px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
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