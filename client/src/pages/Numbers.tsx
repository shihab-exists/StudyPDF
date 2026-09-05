import React, { useMemo, useState } from 'react';
import UploadBox from '../components/UploadBox';
import PageGrid from '../components/PageGrid';
import { usePdfPreview } from '../hooks/usePdfPreview';
import { identityPages } from '../services/pdfPreview';
import { useFileParam } from '../hooks/useFileParam';
import { baseName, getBlob, saveResult } from '../services/store';
import { addPageNumbers, blobBytes, pdfBytes, type CornerPos } from '../services/pdfops';
import { friendly } from '../services/errors';
import type { FileRecord } from '../types';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, DownloadButtons, ErrorState, SectionTitle, SuccessBanner } from '../components/Bits';
import { NumbersIcon, Paperclip, Star } from '../components/Doodles';
import { useToast } from '../components/Toasts';

const POSITIONS: { key: CornerPos; label: string }[] = [
  { key: 'tl', label: 'Top left' },
  { key: 'tc', label: 'Top center' },
  { key: 'tr', label: 'Top right' },
  { key: 'bl', label: 'Bottom left' },
  { key: 'bc', label: 'Bottom center' },
  { key: 'br', label: 'Bottom right' },
];

export default function Numbers() {
  const { rec, setRec, clear, loading, error: loadError, retry } = useFileParam();
  const [position, setPosition] = useState<CornerPos>('bc');
  const [start, setStart] = useState(1);
  const [size, setSize] = useState(12);
  const [margin, setMargin] = useState(24);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FileRecord | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pv = usePdfPreview(rec, (m) => toast(m, 'error'));
  const pvPages = useMemo(() => identityPages(rec?.pages ?? 0), [rec?.pages]);
  const toast = useToast();

  const run = async () => {
    if (!rec) return;
    setErr(null);
    setBusy(true);
    try {
      const blob = await getBlob(rec.id);
      if (!blob) throw new Error('That file is no longer in your browser storage.');
      const bytes = await blobBytes(blob);
      const out = await addPageNumbers(bytes, { position, start, size, margin });
      const saved = await saveResult(`${baseName(rec.originalName)}_numbered.pdf`, pdfBytes(out), 'numbers', rec.pages);
      setResult(saved);
      toast(`✓ Page numbers added to ${saved.pages} pages`, 'ok');
    } catch (e) {
      const msg = friendly(e);
      setErr(msg);
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative max-w-3xl mx-auto">
      <Star size={30} className="doodle floaty hidden md:block" style={{ top: -12, left: -34, ['--fr' as string]: '-6deg' }} />
      <div className="mb-4"><BackToTools /></div>
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-mint t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, right: 34 }} />
        <SectionTitle color="#b07800">Add Page Numbers</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">Stamp real, selectable page numbers onto every page.</p>

        {loadError && <ErrorState message={loadError} onRetry={retry} />}
        {!rec && !loadError && <UploadBox onUploaded={setRec} title="Drop your PDF here" />}
        {loading && <ProgressBar label="Loading file…" />}

        {rec && !result && (
          <div className="space-y-5">
            <div className="bg-white/70 rounded-xl px-4 border-2 border-dashed border-[rgba(18,49,92,.3)] flex items-center gap-3 py-2.5">
              <NumbersIcon size={28} />
              <p className="font-display font-bold truncate flex-1">{rec.originalName}</p>
              <span className="flex gap-2 shrink-0">
                <button className="btn btn-white btn-sm" onClick={() => void pv.toggle()} disabled={pv.loading}>
                  {pv.loading ? 'Loading…' : pv.open ? 'Hide pages' : '👁 Preview pages'}
                </button>
                <button className="btn btn-white btn-sm" onClick={clear}>Change</button>
              </span>
            </div>

            {pv.open && pv.bytes && (
              <div className="bg-white/60 rounded-xl p-3 border-2 border-dashed border-[rgba(18,49,92,.25)]">
                <p className="font-hand text-sm text-[var(--ink-soft)] mb-2">Preview only — numbers are stamped on every page. Click a page to enlarge.</p>
                <PageGrid
                  sources={pv.sources}
                  pages={pvPages}
                  eager={12}
                  overlay={
                    pv.pageSize
                      ? (_p, pos) => (
                          <span
                            className={`pv-pn pv-pn-${position}`}
                            style={{
                              fontSize: `${(size / pv.pageSize!.width) * 100}cqw`,
                              top: position.startsWith('t') ? `${(margin / pv.pageSize!.height) * 100}cqw` : undefined,
                              bottom: position.startsWith('b') ? `${(margin / pv.pageSize!.height) * 100}cqw` : undefined,
                              left: position.endsWith('l') ? `${(margin / pv.pageSize!.width) * 100}cqw` : undefined,
                              right: position.endsWith('r') ? `${(margin / pv.pageSize!.width) * 100}cqw` : undefined,
                            }}
                          >
                            {start + pos}
                          </span>
                        )
                      : undefined
                  }
                />
              </div>
            )}

            <fieldset className="border-0 m-0 p-0">
              <legend className="font-display font-extrabold text-lg mb-2">Position</legend>
              <div className="grid grid-cols-3 gap-2">
                {POSITIONS.map((p) => (
                  <label key={p.key} className={`rad bg-white/60 rounded-xl px-3 py-2 text-center ${position === p.key ? 'outline outline-3 outline-[var(--orange)]' : ''}`}>
                    <input type="radio" name="pos" checked={position === p.key} onChange={() => setPosition(p.key)} disabled={busy} />
                    <span className="box" />
                    <span className="font-display font-bold">{p.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="font-display font-bold text-sm">Start at</span>
                <input className="input-paper mt-1" type="number" min={0} max={999999} value={start} onChange={(e) => setStart(Math.max(0, Number(e.target.value) || 0))} disabled={busy} />
              </label>
              <label className="block">
                <span className="font-display font-bold text-sm">Font size</span>
                <input className="input-paper mt-1" type="number" min={6} max={72} value={size} onChange={(e) => setSize(Math.min(72, Math.max(6, Number(e.target.value) || 12)))} disabled={busy} />
              </label>
              <label className="block">
                <span className="font-display font-bold text-sm">Margin (pt)</span>
                <input className="input-paper mt-1" type="number" min={0} max={200} value={margin} onChange={(e) => setMargin(Math.min(200, Math.max(0, Number(e.target.value) || 0)))} disabled={busy} />
              </label>
            </div>

            {busy ? (
              <ProgressBar label="Stamping page numbers…" />
            ) : (
              <button className="btn btn-yellow btn-lg w-full" onClick={run}><NumbersIcon size={22} /> Add Page Numbers</button>
            )}
            {err && <ErrorState message={err} onRetry={run} />}
          </div>
        )}

        {result && (
          <div className="space-y-5 text-center">
            <SuccessBanner>Page numbers added to {result.pages} pages</SuccessBanner>
            <div className="flex justify-center"><DownloadButtons rec={result} /></div>
            <button className="btn btn-white" onClick={() => { setResult(null); clear(); }}>Number another PDF</button>
          </div>
        )}
      </div>
    </div>
  );
}
