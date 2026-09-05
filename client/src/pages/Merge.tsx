import React, { useEffect, useRef, useState } from 'react';
import { formatBytes, getBlob, saveResult, saveUpload } from '../services/store';
import PageGrid from '../components/PageGrid';
import { blobBytes, mergePageOps, mergePdfs, pageCount } from '../services/pdfops';
import type { GridPage } from '../types';
import { friendly } from '../services/errors';
import type { FileRecord } from '../types';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, DownloadButtons, ErrorState, SectionTitle, SuccessBanner } from '../components/Bits';
import { GripIcon, MergeIcon, Paperclip, PdfDocIcon, Star, TrashIcon, UploadIcon } from '../components/Doodles';
import { useToast } from '../components/Toasts';
import { MAX_UPLOAD_MB } from '../config';

export default function Merge() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [adding, setAdding] = useState<{ done: number; total: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('StudyPDF_Merged.pdf');
  const [result, setResult] = useState<FileRecord | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [pvOpen, setPvOpen] = useState(false);
  const [pvLoading, setPvLoading] = useState(false);
  const [pvList, setPvList] = useState<Uint8Array[] | null>(null);
  const [combined, setCombined] = useState<GridPage[] | null>(null);
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const addFiles = async (list: FileList | File[]) => {
    const arr = [...list];
    if (!arr.length) return;
    setAddErr(null);
    setAdding({ done: 0, total: arr.length, name: arr[0].name });
    const added: FileRecord[] = [];
    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];
      setAdding({ done: i, total: arr.length, name: f.name });
      if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') {
        setAddErr(`❌ "${f.name}" skipped — only PDF files are supported.`);
        continue;
      }
      if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setAddErr(`❌ "${f.name}" skipped — larger than ${MAX_UPLOAD_MB} MB.`);
        continue;
      }
      if (f.size === 0) {
        setAddErr(`❌ "${f.name}" skipped — the file is empty.`);
        continue;
      }
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') {
          setAddErr(`❌ "${f.name}" skipped — this file isn't a valid PDF.`);
          continue;
        }
        const pages = await pageCount(bytes);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        added.push(await saveUpload(f.name, blob, pages));
      } catch (e) {
        setAddErr(`❌ "${f.name}" skipped — ${friendly(e)}`);
      }
    }
    if (added.length) {
      setFiles((cur) => [...cur, ...added]);
      toast(`✓ Added ${added.length} file${added.length === 1 ? '' : 's'}`, 'ok');
    }
    setAdding(null);
  };

  // any file-list change invalidates an open page arrangement
  useEffect(() => {
    if (combined) {
      setPvOpen(false);
      setPvList(null);
      setCombined(null);
      toast('Page preview reset — the file list changed.', 'info');
    }
  }, [files]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPreview = async () => {
    if (pvOpen) {
      setPvOpen(false);
      return;
    }
    setPvLoading(true);
    try {
      const list: Uint8Array[] = [];
      for (const f of files) {
        const blob = await getBlob(f.id);
        if (!blob) throw new Error(`"${f.originalName}" is no longer in your browser storage — add it again.`);
        list.push(await blobBytes(blob));
      }
      const comb: GridPage[] = [];
      files.forEach((f, fi) => {
        for (let p = 1; p <= f.pages; p++) comb.push({ file: fi, src: p, rotate: 0 });
      });
      setPvList(list);
      setCombined(comb);
      setPvOpen(true);
    } catch (e) {
      toast(friendly(e), 'error');
    } finally {
      setPvLoading(false);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= files.length) return;
    setFiles((cur) => {
      const next = [...cur];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  };

  const merge = async () => {
    setBusy(true);
    setErr(null);
    try {
      let bytes: Uint8Array;
      if (pvList && combined) {
        if (!combined.length) throw new Error('Every page was removed in the preview — nothing to merge.');
        bytes = await mergePageOps(
          pvList,
          combined.map((g) => ({ file: g.file, page: g.src, rotate: g.rotate })),
        );
      } else {
        const list: Uint8Array[] = [];
        for (const f of files) {
          const blob = await getBlob(f.id);
          if (!blob) throw new Error(`"${f.originalName}" is no longer in your browser storage — add it again.`);
          list.push(await blobBytes(blob));
        }
        bytes = await mergePdfs(list);
      }
      const pages = await pageCount(bytes);
      const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
      const saved = await saveResult(name.trim() || 'StudyPDF_Merged.pdf', blob, 'merge', pages);
      setResult(saved);
      toast(`✓ Merged into ${saved.originalName} (${saved.pages} pages)`, 'ok');
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
      <Star size={30} className="doodle floaty hidden md:block" style={{ top: -12, left: -34, ['--fr' as string]: '-8deg' }} />
      <div className="mb-4"><BackToTools /></div>
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-cyan t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, right: 34 }} />
        <SectionTitle color="var(--blue-bright)">Merge PDFs</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">Combine multiple PDFs into one file. Drag rows to reorder.</p>

        {!result && (
          <>
            <div
              className="dropzone text-center px-4 py-6"
              role="button"
              tabIndex={0}
              onClick={() => !adding && inputRef.current?.click()}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void addFiles(e.dataTransfer.files);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              {adding ? (
                <div className="max-w-md mx-auto">
                  <ProgressBar percent={Math.round((adding.done / adding.total) * 100)} label={`Reading ${adding.name} (${adding.done + 1}/${adding.total})`} blue />
                </div>
              ) : (
                <>
                  <p className="font-display font-extrabold text-xl text-[var(--blue-bright)] flex items-center justify-center gap-2">
                    <UploadIcon size={22} /> Add PDFs to merge
                  </p>
                  <p className="font-hand text-[var(--ink-soft)]">click or drop multiple files here · max {MAX_UPLOAD_MB} MB each</p>
                </>
              )}
            </div>
            {addErr && <p className="font-hand text-[#c23a2b] mt-2">{addErr}</p>}

            {files.length > 0 && (
              <ol className="list-none m-0 p-0 mt-5 space-y-2">
                {files.map((f, i) => (
                  <li
                    key={f.id}
                    draggable
                    onDragStart={() => (dragIndex.current = i)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverIndex(i);
                    }}
                    onDragLeave={() => setOverIndex((o) => (o === i ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex.current !== null) move(dragIndex.current, i);
                      dragIndex.current = null;
                      setOverIndex(null);
                    }}
                    onDragEnd={() => setOverIndex(null)}
                    className={`flex items-center gap-3 bg-white/80 rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing transition-shadow ${
                      overIndex === i ? 'outline outline-3 outline-[var(--mint)]' : ''
                    }`}
                  >
                    <GripIcon size={20} color="#9aa9c4" />
                    <span className="font-display font-extrabold text-lg text-white bg-[var(--blue-bright)] rounded-lg w-9 h-9 flex items-center justify-center shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <PdfDocIcon size={26} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold truncate">{f.originalName}</p>
                      <p className="font-hand text-sm text-[var(--ink-soft)]">{formatBytes(f.sizeBytes)} · {f.pages} pages</p>
                    </div>
                    <span className="flex gap-1">
                      <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => move(i, i - 1)} aria-label="Move up" disabled={i === 0}>↑</button>
                      <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => move(i, i + 1)} aria-label="Move down" disabled={i === files.length - 1}>↓</button>
                      <button className="icon-btn" style={{ width: 34, height: 34, color: '#c23a2b' }} onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))} aria-label={`Remove ${f.originalName}`}>
                        <TrashIcon size={16} />
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {files.length > 0 && (
              <div className="mt-3 text-center">
                <button className="btn btn-white btn-sm" onClick={() => void openPreview()} disabled={pvLoading}>
                  {pvLoading ? 'Loading preview…' : pvOpen ? 'Hide page preview' : `👁 Preview & arrange ${files.reduce((n, f) => n + f.pages, 0)} pages`}
                </button>
              </div>
            )}

            {pvOpen && pvList && combined && (
              <div className="mt-4 bg-white/60 rounded-xl p-3 border-2 border-dashed border-[rgba(18,49,92,.25)]">
                <p className="font-display font-extrabold">Combined document — {combined.length} page{combined.length === 1 ? '' : 's'}</p>
                <p className="font-hand text-sm text-[var(--ink-soft)] mb-2">
                  Drag pages (or use ← →) to arrange the merged PDF; 🗑 removes a page from the result. This order is exactly what gets merged.
                </p>
                <PageGrid
                  sources={pvList}
                  pages={combined}
                  onPagesChange={setCombined}
                  reorderable
                  deletable
                  eager={12}
                  subLabel={(p) => files[p.file]?.originalName ?? null}
                />
              </div>
            )}

            {files.length >= 2 && (
              <div className="mt-6 space-y-3">
                <label className="block">
                  <span className="font-display font-bold">Output name</span>
                  <input className="input-paper mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="StudyPDF_Merged.pdf" />
                </label>
                {busy ? (
                  <ProgressBar label="Merging your PDFs…" />
                ) : (
                  <button className="btn btn-blue btn-lg w-full" onClick={merge}><MergeIcon size={22} /> Merge {files.length} PDFs</button>
                )}
                {err && <ErrorState message={err} onRetry={merge} />}
              </div>
            )}
            {files.length === 1 && <p className="font-hand text-center text-[var(--ink-soft)] mt-4">Add at least one more PDF to merge 🙂</p>}
          </>
        )}

        {result && (
          <div className="space-y-5 text-center">
            <SuccessBanner>Merged successfully into {result.pages} pages</SuccessBanner>
            <div className="flex justify-center">
              <DownloadButtons rec={result} />
            </div>
            <button
              className="btn btn-white"
              onClick={() => {
                setResult(null);
                setFiles([]);
              }}
            >
              Merge more files
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
