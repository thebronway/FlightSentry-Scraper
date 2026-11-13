'use client';

import { Info } from 'lucide-react';
import Tooltip from '@/components/common/Tooltip';

interface AdminPasswordSectionProps {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmNewPasswordChange: (value: string) => void;
}

export function AdminPasswordSection({
  currentPassword,
  newPassword,
  confirmNewPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmNewPasswordChange,
}: AdminPasswordSectionProps) {
  return (
    <details className="pt-2 border-t border-gunmetal-border/70">
      <summary className="cursor-pointer text-slate-300 font-medium select-none">
        <Tooltip
          content="Rotate the console administrator password and invalidate existing sessions"
          position="top"
        >
          <span className="inline-flex items-center gap-1">
            <span>Change Admin Password</span>
            <Info className="h-3 w-3 text-slate-500 flex-shrink-0" />
          </span>
        </Tooltip>
      </summary>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => onCurrentPasswordChange(e.target.value)}
          placeholder="Current password"
          className="px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 placeholder-zinc-600"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => onNewPasswordChange(e.target.value)}
          placeholder="New password (min 8)"
          className="px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 placeholder-zinc-600"
        />
        <input
          type="password"
          value={confirmNewPassword}
          onChange={(e) => onConfirmNewPasswordChange(e.target.value)}
          placeholder="Confirm new password"
          className="px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 placeholder-zinc-600"
        />
      </div>
    </details>
  );
}