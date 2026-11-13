'use client';

import { BarChart3, Info } from 'lucide-react';
import Tooltip from '@/components/common/Tooltip';
import type { OverallApiKeyUsage } from '@/types';

interface ApiUsageCardProps {
  usage: OverallApiKeyUsage;
}

export function ApiUsageCard({ usage }: ApiUsageCardProps) {
  return (
    <section className="bg-gunmetal-card border border-gunmetal-border rounded-lg shadow-sm p-4 sm:p-5 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-300" />
          <h2 className="text-sm font-bold text-slate-200">
            Overall API Key Usage
          </h2>
        </div>

        <Tooltip
          content="Aggregated authenticated scrape volume across all API keys (excludes admin test scrapes and 429 rate-limit rejections)"
          position="top"
        >
          <span
            tabIndex={0}
            className="inline-flex items-center gap-1 text-xs font-mono text-gunmetal-muted cursor-help"
          >
            <span>All Keys</span>
            <Info className="h-3 w-3 text-slate-400 flex-shrink-0" />
          </span>
        </Tooltip>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border">
          <div className="text-xs text-gunmetal-muted">Last 1 Hour</div>
          <div className="mt-1 text-lg font-mono font-semibold text-slate-100">
            {usage.last1h}
          </div>
          <div className="mt-0.5 text-[11px] text-gunmetal-muted">
            Rolling 60m requests
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border">
          <div className="text-xs text-gunmetal-muted">Last 24 Hours</div>
          <div className="mt-1 text-lg font-mono font-semibold text-slate-100">
            {usage.last24h}
          </div>
          <div className="mt-0.5 text-[11px] text-gunmetal-muted">
            Rolling 24h requests
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border">
          <div className="text-xs text-gunmetal-muted">All-Time Total</div>
          <div className="mt-1 text-lg font-mono font-semibold text-slate-100">
            {usage.total}
          </div>
          <div className="mt-0.5 text-[11px] text-gunmetal-muted">
            Lifetime API requests
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border">
          <div className="text-xs text-gunmetal-muted">Key Inventory</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-mono font-semibold text-emerald-300">
              {usage.activeKeys}
            </span>
            <span className="text-xs text-gunmetal-muted">active</span>
            {usage.revokedKeys > 0 && (
              <>
                <span className="text-gunmetal-border">•</span>
                <span className="text-sm font-mono font-medium text-red-400">
                  {usage.revokedKeys}
                </span>
                <span className="text-xs text-gunmetal-muted">revoked</span>
              </>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-gunmetal-muted">
            {usage.activeKeys + usage.revokedKeys} total minted
          </div>
        </div>
      </div>
    </section>
  );
}