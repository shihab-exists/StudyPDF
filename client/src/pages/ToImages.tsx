import React, { useEffect, useMemo, useState } from 'react';
import { zipSync } from 'fflate';
import UploadBox from '../components/UploadBox';
import PageGrid from '../components/PageGrid';
import { usePdfPreview } from '../hooks/usePdfPreview';
import { identityPages, pageKey } from '../services/pdfPreview';
import { useFileParam } from '../hooks/useFileParam';
import { baseName, downloadBlob, getBlob } from '../services/store';
import { blobBytes, pdfToImages, type RenderedImage } from '../services/pdfops';
import { friendly } from '../services/errors';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, ErrorState, SectionTitle, SuccessBanner } from '../components/Bits';
import { Paperclip, Star, ToImagesIcon } from '../components/Doodles';
import { useToast } from '../components/Toasts';

const SCALES = [
  { key: 1, label: 'Screen (72 dpi)' },
  { key: 1.5, label: 'Good (108 dpi)' },
  { key: 2, label: 'Sharp (144 dpi)' },
];

const QUALITIES = [
  { key: 0.7, label: 'Smaller file' },
  { key: 0.85, label: 'Balanced' },
  { key: 0.95, label: 'Best quality' },
];

export default function ToImages() {
  const { rec, setRec, clear, loading, error: loadError, retry } = useFileParam();
  const [fmt, setFmt] = useState<'png' | 'jpg'>('png');
  const [scale, setScale] = useState(1.5);
  const [quality, setQuality] = useState(0.85);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ page: number; total: number } | null>(null);
  const [images, setImages] = useState<RenderedImage[] | null>(null);
  const [nums, setNums] = useState<number[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pvSel, setPvSel] = useState<Set<string>>(new Set());
  const pv = usePdfPreview(rec, (m) => toast(m, 'error'));
  const pvPages = useMemo(() => identityPages(rec?.pages ?? 0), [rec?.pages]);
  useEffect(() => setPvSel(new Set()), [rec?.id]);
  const toast = useToast();

  useEffect(() => {
    return () => {
      // revoke previews when leaving
      setImages((cur) => {
        cur?.forEach((i) => URL.revokeObjectURL(i.url));
        return cur;
      });
    };
  }, []);

  const run = async () => {
    if (!rec) return;
    setErr(null);
    setBusy(true);
    const only = pvSel.size ? pvPages.filter((p) => pvSel.has(pageKey(p))).map((p) => p.src).sort((a, b) => a - b) : undefined;
    setProgress({ page: 0, total: only?.length ?? rec.pages });
    try {
      const blob = await getBlob(rec.id);
      if (!blob) throw new Error('That file is no longer in your browser storage.');
      const out = await pdfToImages(
        await blobBytes(blob),
        { fmt, quality, scale, baseName: baseName(rec.originalName), only },
        (page, total) => setProgress({ page, total }),
      );
      setNums(only ?? null);
      setImages((cur) => {
        cur?.forEach((i) => URL.revokeObjectURL(i.url));
        return out;
      });
      toast(`✓ Rendered ${out.length} page${out.length === 1 ? '' : 's'} as ${fmt.toUpperCase()}`, 'ok');
    } catch (e) {
      const msg = friendly(e);
      setErr(msg);
      toast(msg, 'error');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const downloadZip = async () => {
    if (!images) return;
    try {
      const files: Record<string, Uint8Array> = {};
      for (const im of images) files[im.fileName] = new Uint8Array(await im.blob.arrayBuffer());
      const zipped = zipSync(files, { level: 6 });
      downloadBlob(new Blob([zipped], { type: 'application/zip' }), `${baseName(rec!.originalName)}_images.zip`);
    } catch (e) {
      toast(friendly(e), 'error');
    }
  };

  return (
    <div className="relative max-w-3xl mx-auto">
      <Star size={30} className="doodle floaty hidden md:block" style={{ top: -12, left: -34, ['--fr' as string]: '-7deg' }} />
      <div className="mb-4"><BackToTools /></div>
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, right: 34 }} />
        <SectionTitle color="var(--blue-bright)">PDF to Images</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">
          Every page rendered to PNG or JPG — right here in your browser, no uploads.
        </p>

        {loadError && <ErrorState message={loadError} onRetry={retry} />}
        {!rec && !loadError && <UploadBox onUploaded={setRec} title="Drop your PDF here" />}
        {loading && <ProgressBar label="Loading file…" />}

        {rec && !images && (
          <div className="space-y-5">
            <div className="bg-white/70 rounded-xl px-4 border-2 border-dashed border-[rgba(18,49,92,.3)] flex items-center gap-3 py-2.5">
              <ToImagesIcon size={28} />
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold truncate">{rec.originalName}</p>
                <p className="font-hand text-sm text-[var(--ink-soft)]">{rec.pages} pages</p>
              </div>
              <span className="flex gap-2 shrink-0">
                <button className="btn btn-white btn-sm" onClick={() => void pv.toggle()} disabled={pv.loading}>
                  {pv.loading ? 'Loading…' : pv.open ? 'Hide pages' : '👁 Pick pages'}
                </button>
                <button className="btn btn-white btn-sm" onClick={clear}>Change</button>
              </span>
            </div>

            {pv.open && pv.bytes && (
              <div className="bg-white/60 rounded-xl p-3 border-2 border-dashed border-[rgba(18,49,92,.25)]">
                <p className="font-hand text-sm text-[var(--ink-soft)] mb-2">
                  Tick pages to convert only those — leave everything unticked to convert all {rec.pages} pages.
                </p>
                <PageGrid sources={pv.sources} pages={pvPages} selected={pvSel} onSelectChange={setPvSel} selectable eager={12} />
                {pvSel.size > 0 && (
                  <p className="font-hand text-sm text-[var(--ink-soft)] mt-2">
                    {pvPages
                      .filter((p) => pvSel.has(pageKey(p)))
                      .map((p, i) => `Image ${i + 1} ← page ${p.src}`)
                      .slice(0, 12)
                      .join(' · ')}
                    {pvSel.size > 12 ? ` · … (${pvSel.size} images)` : ''}
                  </p>
                )}
              </div>
            )}

            <fieldset className="border-0 m-0 p-0">
              <legend className="font-display font-extrabold text-lg mb-2">Format</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className={`rad bg-white/60 rounded-xl px-3 py-2 text-center ${fmt === 'png' ? 'outline outline-3 outline-[var(--orange)]' : ''}`}>
                  <input type="radio" name="fmt" checked={fmt === 'png'} onChange={() => setFmt('png')} disabled={busy} />
                  <span className="box" />
                  <span className="font-display font-bold text-lg">PNG</span>
                  <span className="block font-hand text-sm text-[var(--ink-soft)]">lossless, bigger files</span>
                </label>
                <label className={`rad bg-white/60 rounded-xl px-3 py-2 text-center ${fmt === 'jpg' ? 'outline outline-3 outline-[var(--orange)]' : ''}`}>
                  <input type="radio" name="fmt" checked={fmt === 'jpg'} onChange={() => setFmt('jpg')} disabled={busy} />
                  <span className="box" />
                  <span className="font-display font-bold text-lg">JPG</span>
                  <span className="block font-hand text-sm text-[var(--ink-soft)]">smaller, great for slides</span>
                </label>
              </div>
            </fieldset>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="font-display font-bold text-sm">Resolution</span>
                <select className="input-paper mt-1" value={scale} onChange={(e) => setScale(Number(e.target.value))} disabled={busy}>
                  {SCALES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              {fmt === 'jpg' && (
                <label className="block">
                  <span className="font-display font-bold text-sm">JPG quality</span>
                  <select className="input-paper mt-1" value={quality} onChange={(e) => setQuality(Number(e.target.value))} disabled={busy}>
                    {QUALITIES.map((q) => <option key={q.key} value={q.key}>{q.label}</option>)}
                  </select>
                </label>
              )}
            </div>

            {busy && progress ? (
              <ProgressBar percent={Math.round((progress.page / progress.total) * 100)} label={`Rendering page ${progress.page} of ${progress.total}…`} blue />
            ) : (
              <button className="btn btn-yellow btn-lg w-full" onClick={run}>
                <ToImagesIcon size={22} /> {pvSel.size ? `Convert ${pvSel.size} selected to ${fmt.toUpperCase()}` : `Convert to ${fmt.toUpperCase()}`}
              </button>
            )}
            {err && <ErrorState message={err} onRetry={run} />}
          </div>
        )}

        {images && (
          <div className="space-y-5">
            <SuccessBanner>{images.length} image{images.length === 1 ? '' : 's'} rendered as {fmt.toUpperCase()}</SuccessBanner>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((im, i) => (
                <figure key={im.fileName} className="thumb">
                  <img src={im.url} alt={im.fileName} loading="lazy" />
                  <figcaption className="flex items-center justify-between gap-1 px-1.5 py-1 bg-[var(--paper-dim)]">
                    <span className="font-display font-bold text-xs truncate">Page {nums?.[i] ?? i + 1}</span>
                    <button className="btn btn-white btn-sm" style={{ padding: '2px 8px' }} onClick={() => downloadBlob(im.blob, im.fileName)} aria-label={`Download page ${nums?.[i] ?? i + 1}`}>
                      ⬇
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {images.length > 1 && (
                <button className="btn btn-blue btn-lg" onClick={downloadZip}>⬇ Download all as ZIP</button>
              )}
              <button className="btn btn-white" onClick={() => { images.forEach((i) => URL.revokeObjectURL(i.url)); setImages(null); clear(); }}>
                Convert another PDF
              </button>
              <button className="btn btn-white" onClick={() => { images.forEach((i) => URL.revokeObjectURL(i.url)); setImages(null); }}>
                Change options
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
