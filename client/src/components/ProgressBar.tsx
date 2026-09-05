import React from 'react';

export default function ProgressBar({ percent, label, blue }: { percent?: number; label?: string; blue?: boolean }) {
  const indeterminate = percent === undefined;
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-end mb-1 font-hand text-[1rem] text-[var(--ink-soft)]">
          <span>{label}</span>
          {!indeterminate && <span className="font-display font-bold text-[var(--ink)]">{percent}%</span>}
        </div>
      )}
      <div className={`bar ${blue ? 'bar-blue' : ''} ${indeterminate ? 'indeterminate' : ''}`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: indeterminate ? undefined : `${percent}%` }} />
      </div>
    </div>
  );
}
