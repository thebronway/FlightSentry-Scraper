'use client';

import { Info } from 'lucide-react';
import Tooltip from '@/components/common/Tooltip';

interface OutboundProxySectionProps {
  hasProxy: boolean;
  maskedProxyUrl: string | null;
  proxyInput: string;
  clearProxy: boolean;
  onProxyInputChange: (value: string) => void;
  onClearProxyChange: (checked: boolean) => void;
}

export function OutboundProxySection({
  hasProxy,
  maskedProxyUrl,
  proxyInput,
  clearProxy,
  onProxyInputChange,
  onClearProxyChange,
}: OutboundProxySectionProps) {
  return (
    <div className="pt-2 border-t border-gunmetal-border/70">
      <div className="flex items-center justify-between mb-1">
        <Tooltip
          content="Optional HTTP, HTTPS, or SOCKS5 proxy routed for all Chromium requests"
          position="top"
        >
          <label
            tabIndex={0}
            className="inline-flex items-center gap-1 text-gunmetal-muted cursor-help"
          >
            <span>Outbound Proxy URL (optional)</span>
            <Info className="h-3 w-3 text-slate-500 flex-shrink-0" />
          </label>
        </Tooltip>
        {hasProxy && (
          <Tooltip
            content="Credentials are masked at rest; enter a new URL to replace"
            position="top"
          >
            <span
              tabIndex={0}
              className="font-mono text-emerald-300 cursor-help"
            >
              Active: {maskedProxyUrl}
            </span>
          </Tooltip>
        )}
      </div>
      <input
        type="text"
        value={proxyInput}
        disabled={clearProxy}
        onChange={(e) => onProxyInputChange(e.target.value)}
        placeholder={
          hasProxy
            ? 'Enter new proxy URL to replace existing...'
            : 'http://user:pass@proxy.example.com:8080'
        }
        className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 font-mono placeholder-zinc-600 disabled:opacity-40"
      />
      {hasProxy && (
        <div className="mt-1.5">
          <Tooltip
            content="Clears the saved outbound proxy and reverts to direct connections on save"
            position="top"
          >
            <label className="inline-flex items-center gap-1.5 text-gunmetal-muted cursor-pointer">
              <input
                type="checkbox"
                checked={clearProxy}
                onChange={(e) => onClearProxyChange(e.target.checked)}
                className="rounded border-gunmetal-border bg-gunmetal-canvas"
              />
              <span>Remove configured proxy on save</span>
            </label>
          </Tooltip>
        </div>
      )}
    </div>
  );
}