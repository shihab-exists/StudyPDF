import React, { useMemo, useState } from 'react';
import UploadBox from '../components/UploadBox';
import PageGrid from '../components/PageGrid';
import { usePdfPreview } from '../hooks/usePdfPreview';
import { identityPages } from '../services/pdfPreview';
import { useFileParam } from '../hooks/useFileParam';
import { baseName, getBlob, saveResult } from '../services/store';
import { blobBytes, pdfBytes, watermarkPdf } from '../services/pdfops';
import { friendly } from '../services/errors';
import type { FileRecord } from '../types';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, DownloadButtons, ErrorState, SectionTitle, SuccessBanner } from '../components/Bits';
import { Paperclip, Star, WatermarkIcon } from '../components/Doodles';
import { useToast } from '../components/Toasts';

const SWATCHES = [
  { label: 'Gray', r: 0.55, g: 0.6, b: 0.68 },
  { label: 'Blue', r: 0.18, g: 0.45, b: 0.85 },
  { label: 'Red', r: 1, g: 0.35, b: 0.3 },
  { label: 'Ink', r: 0.07, g: 0.19, b: 0.36 },
];

const QUICK = ['DRAFT', 'CONFIDENTIAL', 'COPY', 'SAMPLE'];

export default function Watermark() {
  const { rec, setRec, clear, loading, error: loadError, retry } = useFileParam();
  const [text, setText] = useState('DRAFT');
  const [position, setPosition] = useState<'center' | 'top' | 'bottom'>('center');
  const [size, setSize] = useState(60);
  const [rotate, setRotate] = useState(45);
  const [opacity, setOpacity] = useState(30);
  const [color, setColor] = useState(SWATCHES[0]);
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
      const out = await watermarkPdf(bytes, {
        text: text.trim(),
        size,
        rotate,
        opacity: opacity / 100,
        color,
        position,
      });
      const saved = await saveResult(`${baseName(rec.originalName)}_watermarked.pdf`, pdfBytes(out), 'watermark', rec.pages);
      setResult(saved);
      toast(`✓ Watermark stamped on ${saved.pages} pages`, 'ok');
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
      <Star size={30} className="doodle floaty hidden md:block" style={{ top: -12, right: -34, ['--fr' as string]: '9deg' }} />
      <div className="mb-4"><BackToTools /></div>
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-pink t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, left: 30 }} />
        <SectionTitle color="#d96a90">Watermark PDF</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">Stamp text across every page — rendered into the PDF, not a sticker on top.</p>

        {loadError && <ErrorState message={loadError} onRetry={retry} />}
        {!rec && !loadError && <UploadBox onUploaded={setRec} title="Drop your PDF here" />}
        {loading && <ProgressBar label="Loading file…" />}

        {rec && !result && (
          <div className="space-y-5">
            <div className="bg-white/70 rounded-xl px-4 border-2 border-dashed border-[rgba(18,49,92,.3)] flex items-center gap-3 py-2.5">
              <WatermarkIcon size={28} />
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
                <p className="font-hand text-sm text-[var(--ink-soft)] mb-2">Preview only — the watermark is stamped on every page. Click a page to enlarge.</p>
                <PageGrid
                  sources={pv.sources}
                  pages={pvPages}
                  eager={12}
                  overlay={
                    pv.pageSize && text.trim()
                      ? () => (
                          <span
                            className={`pv-wm pv-wm-${position}`}
                            style={{
                              fontSize: `${(size / pv.pageSize!.width) * 100}cqw`,
                              opacity: opacity / 100,
                              color: `rgb(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)})`,
                              transform: `translateX(-50%) rotate(${rotate}deg)`,
                            }}
                          >
                            {text}
                          </span>
                        )
                      : undefined
                  }
                />
              </div>
            )}

            <label className="block">
              <span className="font-display font-bold">Watermark text</span>
              <input className="input-paper mt-1" value={text} maxLength={40} onChange={(e) => setText(e.target.value)} disabled={busy} placeholder="DRAFT" />
              <span className="flex gap-2 mt-2 flex-wrap">
                {QUICK.map((q) => (
                  <button key={q} type="button" className="btn btn-white btn-sm" onClick={() => setText(q)} disabled={busy}>{q}</button>
                ))}
              </span>
            </label>

            <div className="grid sm:grid-cols-2 gap-4">
              <fieldset className="border-0 m-0 p-0">
                <legend className="font-display font-bold text-sm mb-1">Position</legend>
                <select className="input-paper" value={position} onChange={(e) => setPosition(e.target.value as 'center' | 'top' | 'bottom')} disabled={busy}>
                  <option value="center">Center (diagonal-friendly)</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </select>
              </fieldset>
              <label className="block">
                <span className="font-display font-bold text-sm">Font size — {size} pt</span>
                <input className="w-full mt-2" type="range" min={12} max={140} value={size} onChange={(e) => setSize(Number(e.target.value))} disabled={busy} />
              </label>
              <label className="block">
                <span className="font-display font-bold text-sm">Rotation — {rotate}°</span>
                <input className="w-full mt-2" type="range" min={-90} max={90} step={5} value={rotate} onChange={(e) => setRotate(Number(e.target.value))} disabled={busy} />
              </label>
              <label className="block">
                <span className="font-display font-bold text-sm">Opacity — {opacity}%</span>
                <input className="w-full mt-2" type="range" min={5} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} disabled={busy} />
              </label>
            </div>

            <div>
              <span className="font-display font-bold text-sm">Color</span>
              <div className="flex gap-2 mt-1">
                {SWATCHES.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className={`w-10 h-10 rounded-xl border-2 ${color.label === s.label ? 'outline outline-3 outline-[var(--orange)]' : ''}`}
                    style={{ background: `rgb(${s.r * 255},${s.g * 255},${s.b * 255})`, borderColor: 'rgba(18,49,92,.4)' }}
                    onClick={() => setColor(s)}
                    disabled={busy}
                    aria-label={`${s.label} watermark`}
                    title={s.label}
                  />
                ))}
              </div>
            </div>

            {busy ? (
              <ProgressBar label="Stamping watermark…" />
            ) : (
              <button className="btn btn-pink btn-lg w-full" onClick={run} disabled={!text.trim()}>
                <WatermarkIcon size={22} /> Add Watermark
              </button>
            )}
            {err && <ErrorState message={err} onRetry={run} />}
          </div>
        )}

        {result && (
          <div className="space-y-5 text-center">
            <SuccessBanner>Watermark added to {result.pages} pages</SuccessBanner>
            <div className="flex justify-center"><DownloadButtons rec={result} /></div>
            <button className="btn btn-white" onClick={() => { setResult(null); clear(); }}>Watermark another PDF</button>
          </div>
        )}
      </div>
    </div>
  );
}
