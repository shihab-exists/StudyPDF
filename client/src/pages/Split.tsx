import React, { useEffect, useMemo, useState } from 'react';
import type { GridPage } from '../types';
import { zipSync } from 'fflate';
import UploadBox from '../components/UploadBox';
import PageGrid from '../components/PageGrid';
import { usePdfPreview } from '../hooks/usePdfPreview';
import { identityPages, pageKey, selectedToRanges } from '../services/pdfPreview';
import { useFileParam } from '../hooks/useFileParam';
import { baseName, downloadBlob, getBlob, saveResult } from '../services/store';
import { blobBytes, parseRanges, splitPdf, type SplitPart } from '../services/pdfops';
import { friendly } from '../services/errors';
import type { FileRecord } from '../types';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, DownloadButtons, ErrorState, SectionTitle, SuccessBanner } from '../components/Bits';
import { Paperclip, SplitIcon, Star } from '../components/Doodles';
import { useToast } from '../components/Toasts';

type Mode = 'every' | 'ranges';

export default function Split() {
  const { rec, setRec, clear, loading, error: loadError, retry } = useFileParam();
  const [mode, setMode] = useState<Mode>('ranges');
  const [rangesText, setRangesText] = useState('');
  const [busy, setBusy] = useState(false);
  const [parts, setParts] = useState<{ part: SplitPart; rec: FileRecord }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pvSel, setPvSel] = useState<Set<string>>(new Set());
  const pv = usePdfPreview(rec, (m) => toast(m, 'error'));
  const pvPages = useMemo(() => identityPages(rec?.pages ?? 0), [rec?.pages]);

  // result preview: one visual group per output file, from the SAME ranges the
  // generator will use (parseRanges is shared with run())
  const splitGroups = useMemo(() => {
    if (!rec || mode === 'every' || !rangesText.trim()) return [] as number[][];
    try {
      return parseRanges(rangesText, rec.pages);
    } catch {
      return []; // incomplete/invalid range while typing — preview simply hides
    }
  }, [mode, rangesText, rec]);
  const { splitPreviewPages, splitPartOf } = useMemo(() => {
    const pages: GridPage[] = [];
    const partOf = new Map<string, number>();
    splitGroups.forEach((g, gi) => {
      for (const n of g) {
        const gp = identityPages(rec?.pages ?? 0)[n - 1];
        if (!gp) continue;
        pages.push(gp);
        partOf.set(pageKey(gp), gi + 1);
      }
    });
    return { splitPreviewPages: pages, splitPartOf: partOf };
  }, [splitGroups, rec?.pages]);
  useEffect(() => setPvSel(new Set()), [rec?.id]);
  const toast = useToast();

  const run = async () => {
    if (!rec) return;
    setErr(null);
    setBusy(true);
    try {
      const blob = await getBlob(rec.id);
      if (!blob) throw new Error('That file is no longer in your browser storage.');
      const bytes = await blobBytes(blob);
      const ranges =
        mode === 'every'
          ? Array.from({ length: rec.pages }, (_, i) => [i + 1])
          : parseRanges(rangesText, rec.pages);
      const result = await splitPdf(bytes, ranges, baseName(rec.originalName));
      const saved: { part: SplitPart; rec: FileRecord }[] = [];
      for (const part of result) {
        saved.push({ part, rec: await saveResult(part.fileName, part.blob, 'split', part.pages) });
      }
      setParts(saved);
      toast(`✓ Split into ${saved.length} file${saved.length === 1 ? '' : 's'}`, 'ok');
    } catch (e) {
      const msg = friendly(e);
      setErr(msg);
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const downloadZip = async () => {
    if (!parts || !rec) return;
    try {
      const files: Record<string, Uint8Array> = {};
      for (const { part } of parts) files[part.fileName] = new Uint8Array(await part.blob.arrayBuffer());
      const zipped = zipSync(files, { level: 6 });
      downloadBlob(new Blob([zipped], { type: 'application/zip' }), `${baseName(rec.originalName)}_split.zip`);
    } catch (e) {
      toast(friendly(e), 'error');
    }
  };

  return (
    <div className="relative max-w-3xl mx-auto">
      <Star size={30} className="doodle floaty hidden md:block" style={{ top: -12, right: -34, ['--fr' as string]: '6deg' }} />
      <div className="mb-4"><BackToTools /></div>
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, left: 30 }} />
        <SectionTitle color="#0d6b4e">Split PDF</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">
          Cut a PDF into pieces — every page on its own, or by ranges like <span className="mark-yellow font-display font-bold text-[var(--ink)]">1-5, 6-10, 11-20</span>.
        </p>

        {loadError && <ErrorState message={loadError} onRetry={retry} />}
        {!rec && !loadError && <UploadBox onUploaded={setRec} title="Drop your PDF here" />}
        {loading && <ProgressBar label="Loading file…" />}

        {rec && !parts && (
          <div className="space-y-5">
            <div className="bg-white/70 rounded-xl px-4 border-2 border-dashed border-[rgba(18,49,92,.3)] flex items-center gap-3 py-2.5">
              <SplitIcon size={28} />
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold truncate">{rec.originalName}</p>
                <p className="font-hand text-sm text-[var(--ink-soft)]">{rec.pages} pages</p>
              </div>
              <span className="flex gap-2 shrink-0">
                <button className="btn btn-white btn-sm" onClick={() => void pv.toggle()} disabled={pv.loading}>
                  {pv.loading ? 'Loading…' : pv.open ? 'Hide pages' : '👁 Preview pages'}
                </button>
                <button className="btn btn-white btn-sm" onClick={clear}>Change</button>
              </span>
            </div>

            {pv.open && pv.bytes && (
              <div className="bg-white/60 rounded-xl p-3 border-2 border-dashed border-[rgba(18,49,92,.25)]">
                <p className="font-hand text-sm text-[var(--ink-soft)] mb-2">
                  Tick the pages that belong together, then send the selection to the range box. Click any page to enlarge it.
                </p>
                <PageGrid sources={pv.sources} pages={pvPages} selected={pvSel} onSelectChange={setPvSel} selectable eager={12} />
                {pvSel.size > 0 && (
                  <button
                    className="btn btn-white btn-sm mt-3"
                    disabled={busy}
                    onClick={() => {
                      const r = selectedToRanges(pvPages, pvSel);
                      setRangesText(r);
                      setMode('ranges');
                      toast(`Ranges set from your selection: ${r}`, 'info');
                    }}
                  >
                    ✂ Use {pvSel.size} selected page{pvSel.size === 1 ? '' : 's'} as ranges
                  </button>
                )}
              </div>
            )}

            <fieldset className="border-0 m-0 p-0">
              <legend className="font-display font-extrabold text-lg mb-2">How should we split it?</legend>
              <div className="space-y-2">
                <label className={`rad w-full bg-white/60 rounded-xl px-3 py-2 ${mode === 'ranges' ? 'outline outline-3 outline-[var(--orange)]' : ''}`}>
                  <input type="radio" name="split-mode" checked={mode === 'ranges'} onChange={() => setMode('ranges')} disabled={busy} />
                  <span className="box" />
                  <span>
                    <span className="font-display font-bold text-lg">By page ranges</span>
                    <span className="block font-hand text-sm text-[var(--ink-soft)]">One PDF per range — great for chapters or parts.</span>
                  </span>
                </label>
                <label className={`rad w-full bg-white/60 rounded-xl px-3 py-2 ${mode === 'every' ? 'outline outline-3 outline-[var(--orange)]' : ''}`}>
                  <input type="radio" name="split-mode" checked={mode === 'every'} onChange={() => setMode('every')} disabled={busy} />
                  <span className="box" />
                  <span>
                    <span className="font-display font-bold text-lg">Every page → its own PDF</span>
                    <span className="block font-hand text-sm text-[var(--ink-soft)]">{rec.pages} single-page files, zipped for one download.</span>
                  </span>
                </label>
              </div>
            </fieldset>

            {splitGroups.length > 0 && (
              <div className="bg-white/60 rounded-xl p-3 border-2 border-dashed border-[rgba(18,49,92,.25)]">
                <p className="font-display font-extrabold">Result preview — {splitGroups.length} output file{splitGroups.length === 1 ? '' : 's'}</p>
                <ul className="list-none m-0 p-0 mb-2 space-y-0.5">
                  {splitGroups.slice(0, 8).map((g, i) => (
                    <li key={i} className="font-hand text-sm text-[var(--ink-soft)]">
                      <b className="font-display">Part {i + 1}:</b>{' '}
                      {g.length === 1 ? `page ${g[0]}` : `pages ${g[0]}–${g[g.length - 1]}`} ({g.length} page{g.length === 1 ? '' : 's'})
                    </li>
                  ))}
                  {splitGroups.length > 8 && <li className="font-hand text-sm text-[var(--ink-soft)]">… and {splitGroups.length - 8} more parts</li>}
                </ul>
                <PageGrid sources={pv.sources} pages={splitPreviewPages} eager={12} subLabel={(p) => `Part ${splitPartOf.get(pageKey(p)) ?? 1}`} />
              </div>
            )}

            {mode === 'ranges' && (
              <label className="block">
                <span className="font-display font-bold">Ranges (comma or new line separated)</span>
                <textarea
                  className="input-paper mt-1 font-hand"
                  rows={3}
                  placeholder={'1-5\n6-10\n11-20'}
                  value={rangesText}
                  onChange={(e) => setRangesText(e.target.value)}
                  disabled={busy}
                />
                <span className="font-hand text-sm text-[var(--ink-soft)]">Single pages work too — e.g. 3, 7-9</span>
              </label>
            )}

            {busy ? (
              <ProgressBar label="Cutting your PDF…" />
            ) : (
              <button className="btn btn-yellow btn-lg w-full" onClick={run}>
                <SplitIcon size={22} /> Split PDF
              </button>
            )}
            {err && <ErrorState message={err} onRetry={run} />}
          </div>
        )}

        {parts && (
          <div className="space-y-5">
            <SuccessBanner>Split into {parts.length} file{parts.length === 1 ? '' : 's'}</SuccessBanner>
            <ul className="list-none m-0 p-0 space-y-2">
              {parts.map(({ part, rec: r }) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 bg-white/80 rounded-xl px-3 py-2">
                  <SplitIcon size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold truncate">{part.fileName}</p>
                    <p className="font-hand text-sm text-[var(--ink-soft)]">{part.pages} page{part.pages === 1 ? '' : 's'}</p>
                  </div>
                  <DownloadButtons rec={r} />
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-center gap-3">
              {parts.length > 1 && (
                <button className="btn btn-blue btn-lg" onClick={downloadZip}>
                  ⬇ Download all as ZIP
                </button>
              )}
              <button className="btn btn-white" onClick={() => { setParts(null); clear(); }}>
                Split another PDF
              </button>
              <button className="btn btn-white" onClick={() => setParts(null)}>
                Try different ranges
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
