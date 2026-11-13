'use client';

import React, { useState, useRef, useCallback } from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
  align?: 'left' | 'center' | 'right';
  className?: string;
  disabled?: boolean;
}

export default function Tooltip({
  content,
  children,
  position = 'top',
  align = 'center',
  className = '',
  disabled = false,
}: TooltipProps) {
  const [shiftState, setShiftState] = useState<{
    shiftX: number;
    arrowShift: number;
    resolvedPosition: 'top' | 'bottom';
  }>({ shiftX: 0, arrowShift: 0, resolvedPosition: position });
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (!containerRef.current || !tooltipRef.current) return;

    const triggerRect = containerRef.current.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current.offsetWidth;
    const tooltipHeight = tooltipRef.current.offsetHeight;
    if (tooltipWidth === 0) return;

    // Detect enclosing boundaries: Card container, Table row, Table, or Document
    const boundaryEl = containerRef.current.closest('.group\\/card, tr, table, .bg-gunmetal-card') || document.body;
    const boundaryRect = boundaryEl.getBoundingClientRect();

    const padding = 8;
    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    const idealLeft = triggerCenter - tooltipWidth / 2;
    const idealRight = triggerCenter + tooltipWidth / 2;

    const minLeft = Math.max(boundaryRect.left + padding, padding);
    const maxRight = Math.min(boundaryRect.right - padding, window.innerWidth - padding);

    let shift = 0;
    if (idealLeft < minLeft) {
      shift = minLeft - idealLeft;
    } else if (idealRight > maxRight) {
      shift = maxRight - idealRight;
    }

    let resolvedPosition = position;
    const minTop = Math.max(boundaryRect.top + padding, padding);
    const maxBottom = Math.min(boundaryRect.bottom - padding, window.innerHeight - padding);
    if (position === 'top' && triggerRect.top - tooltipHeight - 6 < minTop) {
      resolvedPosition = 'bottom';
    } else if (position === 'bottom' && triggerRect.bottom + tooltipHeight + 6 > maxBottom) {
      resolvedPosition = 'top';
    }

    const maxArrowOffset = Math.max(0, tooltipWidth / 2 - 12);
    const arrow = Math.max(-maxArrowOffset, Math.min(maxArrowOffset, -shift));

    setShiftState({ shiftX: shift, arrowShift: arrow, resolvedPosition });
  }, [position]);

  if (!content || disabled) {
    return <>{children}</>;
  }

  const effectivePosition = shiftState.resolvedPosition;
  const positionContainerClasses =
    effectivePosition === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5';

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onFocus={handleMouseEnter}
      className={`relative inline-flex group/tooltip hover:z-50 focus-within:z-50 ${className}`}
    >
      {children}
      <div
        ref={tooltipRef}
        role="tooltip"
        style={{
          left: '50%',
          transform: `translateX(calc(-50% + ${shiftState.shiftX}px))`,
        }}
        className={`pointer-events-none absolute ${positionContainerClasses} opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 transition-opacity duration-150 ease-out z-50 flex flex-col items-center`}
      >
        {effectivePosition === 'bottom' && (
          <div
            style={{ transform: `translateX(${shiftState.arrowShift}px) rotate(45deg)` }}
            className="w-1.5 h-1.5 bg-gunmetal-card border-l border-t border-slate-600 -mb-1 flex-shrink-0"
          />
        )}
        <div className="w-max max-w-[240px] sm:max-w-[270px] bg-gunmetal-card/95 text-slate-100 text-[11px] font-sans font-semibold leading-snug text-center px-2.5 py-1.5 rounded shadow-2xl border border-slate-600 whitespace-normal break-words backdrop-blur-sm">
          {content}
        </div>
        {effectivePosition === 'top' && (
          <div
            style={{ transform: `translateX(${shiftState.arrowShift}px) rotate(45deg)` }}
            className="w-1.5 h-1.5 bg-gunmetal-card border-r border-b border-slate-600 -mt-1 flex-shrink-0"
          />
        )}
      </div>
    </div>
  );
}