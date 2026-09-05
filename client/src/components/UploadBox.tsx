import React, { useRef, useState } from 'react';
import { formatBytes, saveUpload } from '../services/store';
import { openPdf } from '../services/pdfjs';
import { friendly } from '../services/errors';
import type { FileRecord } from '../types';
import ProgressBar from './ProgressBar';
import { PdfDocIcon, UploadIcon, XIcon } from './Doodles';
import { MAX_UPLOAD_MB } from '../config';
import { useToast } from './Toasts';

interface Props {
  onUploaded: (rec: FileRecord) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

/** Reads a File with real progress events and cancel support. */
function readFile(file: File, onProgress: (pct: number) => void, signal: { cancelled: boolean }): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(new Error('Could not read the file from your device.'));
    fr.onabort = () => reject(new Error('cancelled'));
    const timer = setInterval(() => {
      if (signal.cancelled) {
        fr.abort();
        clearInterval(timer);
      }
    }, 120);
    fr.onloadend = () => clearInterval(timer);
    fr.readAsArrayBuffer(file);
  });
}

/**
 * The one true upload box: click to browse, drag & drop, PDF + size validation,
 * real read progress, cancel, and friendly error messages.
 * The file never leaves the device — it is stored in IndexedDB for 24 h.
 */
export default function UploadBox({ onUploaded, title = 'Drop your PDF here', subtitle, compact }: Props) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [stage, setStage] = useState('Reading file…');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef({ cancelled: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const validate = (file: File): string | null => {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      return '❌ Only PDF files are supported.';
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return `❌ File is larger than ${MAX_UPLOAD_MB} MB.`;
    }
    if (file.size === 0) return '❌ This file is empty.';
    return null;
  };

  const start = async (file: File) => {
    setError(null);
    const problem = validate(file);
    if (problem) {
      setError(problem);
      toast(problem, 'error');
      return;
    }
    setFileName(file.name);
    setBusy(true);
    setPct(0);
    setStage('Reading file…');
    cancelRef.current = { cancelled: false };
    try {
      const buf = await readFile(file, setPct, cancelRef.current);
      const head = new Uint8Array(buf, 0, Math.min(5, buf.byteLength));
      if (String.fromCharCode(...head) !== '%PDF-') {
        throw new Error("This file isn't a valid PDF.");
      }
      setStage('Counting pages…');
      const bytes = new Uint8Array(buf);
      let pages = 0;
      try {
        const doc = await openPdf(bytes);
        pages = doc.numPages;
        void doc.destroy();
      } catch (e) {
        throw new Error(friendly(e));
      }
      const blob = new Blob([buf], { type: 'application/pdf' });
      const rec = await saveUpload(file.name, blob, pages);
      toast(`✓ ${rec.originalName} ready (${rec.pages} page${rec.pages === 1 ? '' : 's'}, ${formatBytes(rec.sizeBytes)})`, 'ok');
      onUploaded(rec);
    } catch (e) {
      let msg = e instanceof Error ? e.message : 'Upload failed.';
      if (/IndexedDB|database|storage/i.test(msg) && msg !== 'cancelled') {
        msg = 'Your browser storage is unavailable (private browsing mode?). StudyPDF keeps files locally — please switch to a normal window and try again.';
      }
      if (msg !== 'cancelled') {
        const shown = `❌ ${msg}`;
        setError(shown);
        toast(msg, 'error');
      } else {
        setError('Upload cancelled.');
      }
    } finally {
      setBusy(false);
      setPct(0);
      setFileName('');
    }
  };

  return (
    <div>
      <div
        className={`dropzone ${drag ? 'drag' : ''} text-center ${compact ? 'px-4 py-6' : 'px-6 py-10'}`}
        role="button"
        tabIndex={0}
        aria-label="Upload a PDF"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !busy) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void start(f);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void start(f);
            e.target.value = '';
          }}
        />
        {busy ? (
          <div className="max-w-md mx-auto space-y-3">
            <div className="flex items-center justify-center gap-2 font-display font-bold text-lg text-[var(--ink)]">
              <PdfDocIcon size={30} />
              <span className="truncate max-w-[260px]">{fileName}</span>
            </div>
            <ProgressBar percent={pct} label={`${stage} ${pct}%`} />
            <button
              className="btn btn-white btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                cancelRef.current.cancelled = true;
              }}
            >
              <XIcon size={16} /> Cancel upload
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-3 floaty">
              <span className="relative inline-block">
                <PdfDocIcon size={compact ? 44 : 62} />
                <span className="absolute -right-3 -bottom-1 bg-[var(--blue-bright)] text-white rounded-full p-1">
                  <UploadIcon size={compact ? 14 : 18} />
                </span>
              </span>
            </div>
            <p className="font-display font-extrabold text-xl sm:text-2xl text-[var(--blue-bright)]">{title}</p>
            <p className="font-hand text-[var(--ink-soft)] my-1">or</p>
            <span className="btn btn-yellow btn-lg inline-flex" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
              Browse Files
            </span>
            <p className="font-hand text-sm text-[var(--ink-soft)] mt-3">
              {subtitle || `(Max file size: ${MAX_UPLOAD_MB}MB · processed privately in your browser)`}
            </p>
          </>
        )}
      </div>
      {error && !busy && (
        <p className="mt-2 font-hand text-[1.05rem] text-[#c23a2b] bg-[#ffd7d3] rounded-xl px-3 py-1.5 inline-block">{error}</p>
      )}
    </div>
  );
}
