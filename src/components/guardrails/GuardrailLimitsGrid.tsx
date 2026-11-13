'use client';

import { Info } from 'lucide-react';
import Tooltip from '@/components/common/Tooltip';
import {
  GUARDRAIL_FIELDS,
  type GuardrailValues,
} from './guardrailsConfig';

interface GuardrailLimitsGridProps {
  values: GuardrailValues;
  onChange: (key: keyof GuardrailValues, value: number) => void;
}

export function GuardrailLimitsGrid({
  values,
  onChange,
}: GuardrailLimitsGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {GUARDRAIL_FIELDS.map((field) => (
        <div key={field.key}>
          <div className="mb-1">
            <Tooltip
              content={
                <>
                  <span className="block">{field.description}</span>
                  <span className="block text-slate-400 font-normal mt-0.5">
                    {field.defaultLabel}
                  </span>
                </>
              }
              position="top"
            >
              <label
                tabIndex={0}
                className="inline-flex items-center gap-1 text-gunmetal-muted cursor-help"
              >
                <span>{field.label}</span>
                <Info className="h-3 w-3 text-slate-500 flex-shrink-0" />
              </label>
            </Tooltip>
          </div>
          <input
            type="number"
            min={field.min}
            max={field.max}
            required
            value={values[field.key]}
            onChange={(e) => onChange(field.key, Number(e.target.value))}
            className="w-full px-2.5 py-1.5 rounded-lg bg-gunmetal-canvas border border-gunmetal-border text-slate-100 font-mono"
          />
        </div>
      ))}
    </div>
  );
}