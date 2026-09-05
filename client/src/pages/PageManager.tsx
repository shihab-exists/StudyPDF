import React, { useEffect, useMemo, useRef, useState } from 'react';
import UploadBox from '../components/UploadBox';
import PageGrid from '../components/PageGrid';
import { useFileParam } from '../hooks/useFileParam';
import { baseName, getBlob, saveResult } from '../services/store';
import { applyPageOps, blobBytes, pageCount, pdfBytes, sanitizeName } from '../services/pdfops';
import { pageKey } from '../services/pdfPreview';
import { friendly } from '../services/errors';
import type { FileRecord, GridPage } from '../types';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, DownloadButtons, ErrorState, SectionTitle, SuccessBanner } from '../components/Bits';
import { Paperclip, Star, TrashIcon } from '../components/Doodles';
import { useToast } from '../components/Toasts';

function parseRange(input: string, max: number): number[] | null {
  const out = new Set<number>();
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < 1 || a > max || b > max || a > b) return null;
    for (let p = a; p <= b; p++) out.add(p);
  }
  return [...out].sort((x, y) => x - y);
}

export default function PageManager() {
  const { rec, setRec, clear, loading, error: loadError, retry } = useFileParam();
  const [pages, setPages] = useState<GridPage[]>([]);
  const [srcBytes, setSrcBytes] = useState<Uint8Array | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // identity keys: `${file}:${src}`
  const [range, setRange] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ rec: FileRecord; kind: 'edit' | 'extract' } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const bytesRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!rec) {
        setPages([]);
        setSrcBytes(null);
        bytesRef.current = null;
        return;
      }
      setResult(null);
      setSelected(new Set());
      setRange('');
      setErr(null);
      setSrcBytes(null);
      try {
        const blob = await getBlob(rec.id);
        if (!blob || cancelled) return;
        const bytes = await blobBytes(blob);
        bytesRef.current = bytes;
        const n = await pageCount(bytes);
        if (cancelled) return;
        setPages(Array.from({ length: n }, (_, i) => ({ file: 0, src: i + 1, rotate: 0 })));
        setSrcBytes(bytes); // PageGrid draws the thumbnails lazily from these bytes
      } catch (e) {
        if (!cancelled) setErr(friendly(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rec?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const gridSources = useMemo(() => (srcBytes ? [srcBytes] : []), [srcBytes]);

  // live result preview for Extract: exactly the pages+order the button will use
  const extractPositions = range.trim()
    ? (parseRange(range, pages.length) ?? []).map((n) => n - 1)
    : pages.reduce<number[]>((acc, p, i) => {
        if (selected.has(pageKey(p))) acc.push(i);
        return acc;
      }, []);
  const extractPreview = useMemo(() => extractPositions.map((i) => pages[i]).filter(Boolean), [range, selected, pages]); // eslint-disable-line react-hooks/exhaustive-deps
  const extractSeq = extractPreview.length
    ? `${extractPreview.slice(0, 12).map((p) => p.src).join(' → ')}${extractPreview.length > 12 ? ` → … (${extractPreview.length} pages)` : ''}`
    : '';

  const rotateSelected = () => {
    setPages((cur) => cur.map((p) => (selected.has(pageKey(p)) ? { ...p, rotate: (p.rotate + 90) % 360 } : p)));
    toast(`Rotated ${selected.size} page${selected.size === 1 ? '' : 's'} ↻`, 'info');
  };

  const deleteSelected = () => {
    const n = selected.size;
    setPages((cur) => cur.filter((p) => !selected.has(pageKey(p))));
    setSelected(new Set());
    toast(`Deleted ${n} page${n === 1 ? '' : 's'} 🗑`, 'info');
  };

  // absolute positions (in operation state) of the current selection, in order
  const selectedPositions = pages.reduce<number[]>((acc, p, i) => {
    if (selected.has(pageKey(p))) acc.push(i);
    return acc;
  }, []);

  const process = async (kind: 'edit' | 'extract') => {
    if (!rec || !bytesRef.current) return;
    setErr(null);
    let ops: { page: number; rotate: number }[];
    if (kind === 'extract') {
      const positions = range.trim() ? (parseRange(range, pages.length) ?? []).map((n) => n - 1) : selectedPositions;
      if (!positions.length) {
        setErr('Select pages or type a range like 2, 5, 7–10 first.');
        return;
      }
      ops = positions.map((n) => ({ page: pages[n].src - 1, rotate: pages[n].rotate }));
    } else {
      if (!pages.length) {
        setErr('No pages left — nothing to save.');
        return;
      }
      ops = pages.map((p) => ({ page: p.src - 1, rotate: p.rotate }));
    }
    setBusy(kind === 'edit' ? 'Applying your changes…' : 'Extracting pages…');
    try {
      const bytes = await applyPageOps(bytesRef.current, ops);
      const name = `${baseName(rec.originalName)}_${kind === 'edit' ? 'edited' : 'extracted'}.pdf`;
      const saved = await saveResult(sanitizeName(name), pdfBytes(bytes), kind === 'edit' ? 'pages' : 'extract', ops.length);
      setResult({ rec: saved, kind });
      toast(`✓ ${kind === 'edit' ? 'Saved' : 'Extracted'} → ${saved.originalName}`, 'ok');
    } catch (e) {
      const msg = friendly(e);
      setErr(msg);
      toast(msg, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative">
      <Star size={30} className="doodle floaty hidden md:block" style={{ top: -12, right: -34, ['--fr' as string]: '10deg' }} />
      <div className="mb-4"><BackToTools /></div>
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-pink t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, left: 30 }} />
        <SectionTitle color="#e0567f">Page Manager</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">
          One manager, four superpowers: <b>reorder</b> (drag), <b>rotate</b> ↻, <b>delete</b> 🗑 and <b>extract</b> ✂️.
        </p>

        {loadError && <ErrorState message={loadError} onRetry={retry} />}

        {!rec && !loadError && <UploadBox onUploaded={setRec} title="Drop your PDF here" subtitle="Every page becomes a draggable thumbnail" />}
        {loading && <ProgressBar label="Loading pages…" />}

        {rec && (
          <>
            {/* toolbar */}
            <div className="flex flex-wrap items-center gap-2 mb-4 bg-white/70 rounded-xl px-3 py-2 border-2 border-dashed border-[rgba(18,49,92,.25)]">
              <span className="font-display font-bold truncate max-w-[40%]" title={rec.originalName}>{rec.originalName}</span>
              <span className="font-hand text-sm text-[var(--ink-soft)]">({pages.length} page{pages.length === 1 ? '' : 's'}{selected.size ? `, ${selected.size} selected` : ''})</span>
              <span className="flex-1" />
              <button className="btn btn-white btn-sm" onClick={() => setSelected(new Set(pages.map(pageKey)))}>Select all</button>
              <button className="btn btn-white btn-sm" onClick={() => setSelected(new Set())}>None</button>
              <button className="btn btn-blue btn-sm" onClick={rotateSelected} disabled={!selected.size}>↻ Rotate</button>
              <button className="btn btn-red btn-sm" onClick={deleteSelected} disabled={!selected.size}><TrashIcon size={16} /> Delete</button>
              <button className="btn btn-white btn-sm" onClick={clear}>Change file</button>
            </div>

            {/* thumbnails — shared lazy PageGrid (click any page to enlarge) */}
            {srcBytes && (
              <PageGrid
                sources={gridSources}
                pages={pages}
                onPagesChange={setPages}
                selected={selected}
                onSelectChange={setSelected}
                selectable
                reorderable
                rotatable
                deletable
              />
            )}
            {pages.length === 0 && srcBytes && (
              <p className="font-hand text-center text-lg text-[#c23a2b] py-6">All pages deleted — change file to start over.</p>
            )}

            {/* actions */}
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              <div className="bg-white/70 rounded-xl p-4 border-2 border-dashed border-[rgba(18,49,92,.25)]">
                <p className="font-display font-extrabold text-lg">✂️ Extract pages</p>
                <p className="font-hand text-sm text-[var(--ink-soft)] mb-2">Type a range (or use your selection) — a new PDF is created.</p>
                <input className="input-paper" placeholder="e.g. 2, 5, 7–10" value={range} onChange={(e) => setRange(e.target.value)} />
                {extractPreview.length > 0 && (
                  <div className="mt-3 bg-white/60 rounded-xl p-2.5 border-2 border-dashed border-[rgba(18,49,92,.2)]">
                    <p className="font-display font-bold text-sm mb-1">Result preview — {extractPreview.length} page{extractPreview.length === 1 ? '' : 's'} in this order:</p>
                    <p className="font-hand text-sm text-[var(--ink-soft)] mb-2 truncate" title={extractSeq}>
                      {extractSeq}
                    </p>
                    <PageGrid sources={gridSources} pages={extractPreview} eager={12} width={120} />
                  </div>
                )}
                <button className="btn btn-pink w-full mt-3" onClick={() => process('extract')} disabled={!!busy}>
                  Extract Pages
                </button>
              </div>
              <div className="bg-white/70 rounded-xl p-4 border-2 border-dashed border-[rgba(18,49,92,.25)] flex flex-col">
                <p className="font-display font-extrabold text-lg">Save rearranged / edited PDF</p>
                <p className="font-hand text-sm text-[var(--ink-soft)] mb-2">Applies your current order, rotations and deletions.</p>
                <div className="mt-auto">
                  {busy ? <ProgressBar label={busy} /> : (
                    <button className="btn btn-yellow w-full" onClick={() => process('edit')} disabled={!pages.length}>
                      Save as new PDF
                    </button>
                  )}
                </div>
              </div>
            </div>
            {err && <p className="font-hand text-[#c23a2b] mt-3 text-center">❌ {err}</p>}

            {result && (
              <div className="mt-6 space-y-4 bg-[#d9f5e7]/60 rounded-2xl p-5 border-2 border-[#2eb884]">
                <SuccessBanner>
                  {result.kind === 'edit' ? 'Edited' : 'Extracted'} PDF ready — {result.rec.pages} page{result.rec.pages === 1 ? '' : 's'}
                </SuccessBanner>
                <div className="flex flex-wrap justify-center gap-3">
                  <DownloadButtons rec={result.rec} />
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    className="btn btn-white btn-sm"
                    onClick={() => {
                      setRec(result.rec);
                    }}
                  >
                    Continue editing this result
                  </button>
                  <button className="btn btn-white btn-sm" onClick={() => { setResult(null); clear(); }}>
                    Start over
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
