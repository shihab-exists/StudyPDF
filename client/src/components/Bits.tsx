import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckIcon, PdfDocIcon, WarnIcon } from './Doodles';
import { downloadBlob, formatBytes, getBlob, openInTab } from '../services/store';
import type { FileRecord } from '../types';

/** Sticker-style section label, e.g. "Our Tools" */
export function SectionTitle({ children, color = 'var(--orange)' }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="inline-block relative -rotate-1 mb-6">
      <span
        className="font-display font-extrabold text-xl sm:text-2xl text-white px-5 py-2 rounded-lg inline-block"
        style={{ background: color, boxShadow: '0 0 0 5px #fff, 0 8px 18px rgba(4,22,58,.35)' }}
      >
        {children}
      </span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="paper torn-sheet rounded-md p-8 text-center max-w-md mx-auto">
      <div className="flex justify-center mb-3"><WarnIcon size={52} /></div>
      <h3 className="font-display font-extrabold text-2xl">Something went wrong.</h3>
      <p className="font-hand text-lg text-[var(--ink-soft)] mt-1">{message}</p>
      {onRetry && (
        <button className="btn btn-yellow mt-4" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}

export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 bg-[#d9f5e7] border-l-8 border-[#2eb884] rounded-xl px-4 py-2.5 font-display font-bold text-[#0d6b4e]">
      <CheckIcon size={20} /> {children}
    </div>
  );
}

export function FileRow({ rec, right }: { rec: FileRecord; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="sticker p-1.5 shrink-0"><PdfDocIcon size={26} /></span>
      <div className="min-w-0 flex-1">
        <p className="font-display font-bold truncate" title={rec.originalName}>{rec.originalName}</p>
        <p className="font-hand text-sm text-[var(--ink-soft)]">
          {formatBytes(rec.sizeBytes)} · {rec.pages} page{rec.pages === 1 ? '' : 's'}
        </p>
      </div>
      {right}
    </div>
  );
}

export function StatBox({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-white/70 rounded-xl px-4 py-3 border-2 border-dashed border-[rgba(18,49,92,.3)] text-center">
      <p className="font-hand text-sm text-[var(--ink-soft)]">{label}</p>
      <p className="font-display font-extrabold text-xl" style={{ color: accent || 'var(--ink)' }}>{value}</p>
    </div>
  );
}

/** Downloads a stored result straight from IndexedDB (object URL). */
export function DownloadButtons({ rec, extra, downloadLabel = '⬇ Download PDF' }: { rec: FileRecord; extra?: React.ReactNode; downloadLabel?: string }) {
  const download = async () => {
    const blob = await getBlob(rec.id);
    if (blob) downloadBlob(blob, rec.originalName);
  };
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <button className="btn btn-yellow btn-lg" onClick={download}>
        {downloadLabel}
      </button>
      <button className="btn btn-white" onClick={() => void openInTab(rec.id)}>
        Open
      </button>
      {extra}
    </div>
  );
}

export function BackToTools() {
  return (
    <Link to="/tools" className="back-pill" aria-label="Back to all tools">
      <span aria-hidden="true" style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
        <ArrowRight size={16} />
      </span>
      All tools
    </Link>
  );
}

export function ContinueLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="btn btn-white btn-sm">
      {label} <ArrowRight size={16} />
    </Link>
  );
}
