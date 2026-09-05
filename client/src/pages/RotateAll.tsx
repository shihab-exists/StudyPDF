import React, { useEffect, useState } from 'react';
import UploadBox from '../components/UploadBox';
import { useFileParam } from '../hooks/useFileParam';
import { baseName, getBlob, saveResult } from '../services/store';
import { applyPageOps, blobBytes, pageCount, pageThumbDataUrl, pdfBytes } from '../services/pdfops';
import { friendly } from '../services/errors';
import type { FileRecord } from '../types';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, DownloadButtons, ErrorState, SectionTitle, SuccessBanner } from '../components/Bits';
import { Paperclip, RotateAllIcon, Star } from '../components/Doodles';
import { useToast } from '../components/Toasts';

const ANGLES = [
  { deg: 90, label: '90° clockwise' },
  { deg: 180, label: '180°' },
  { deg: 270, label: '270° clockwise' },
];

export default function RotateAll() {
  const { rec, setRec, clear, loading, error: loadError, retry } = useFileParam();
  const [deg, setDeg] = useState(90);
  const [thumb, setThumb] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FileRecord | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setThumb(null);
      setResult(null);
      if (!rec) return;
      try {
        const blob = await getBlob(rec.id);
        if (!blob || cancelled) return;
        const url = await pageThumbDataUrl(await blobBytes(blob), 1, 200);
        if (!cancelled) setThumb(url);
      } catch {
        /* preview is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rec?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    if (!rec) return;
    setErr(null);
    setBusy(true);
    try {
      const blob = await getBlob(rec.id);
      if (!blob) throw new Error('That file is no longer in your browser storage.');
      const bytes = await blobBytes(blob);
      const n = await pageCount(bytes);
      const out = await applyPageOps(
        bytes,
        Array.from({ length: n }, (_, i) => ({ page: i, rotate: deg })),
      );
      const saved = await saveResult(`${baseName(rec.originalName)}_rotated.pdf`, pdfBytes(out), 'rotate', n);
      setResult(saved);
      toast(`✓ Rotated ${n} pages by ${deg}°`, 'ok');
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
      <Star size={30} className="doodle floaty hidden md:block" style={{ top: -12, right: -34, ['--fr' as string]: '7deg' }} />
      <div className="mb-4"><BackToTools /></div>
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-cyan t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, left: 30 }} />
        <SectionTitle color="var(--blue-bright)">Rotate All Pages</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">
          Whole document turned in one click — uses the same engine as Page Manager.
        </p>

        {loadError && <ErrorState message={loadError} onRetry={retry} />}
        {!rec && !loadError && <UploadBox onUploaded={setRec} title="Drop your PDF here" />}
        {loading && <ProgressBar label="Loading file…" />}

        {rec && !result && (
          <div className="space-y-5">
            <div className="bg-white/70 rounded-xl px-4 border-2 border-dashed border-[rgba(18,49,92,.3)] flex items-center gap-3 py-2.5">
              <RotateAllIcon size={28} />
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold truncate">{rec.originalName}</p>
                <p className="font-hand text-sm text-[var(--ink-soft)]">{rec.pages} pages</p>
              </div>
              <button className="btn btn-white btn-sm" onClick={clear}>Change</button>
            </div>

            {thumb && (
              <div className="flex justify-center gap-6 items-end flex-wrap">
                <figure className="text-center">
                  <img src={thumb} alt="First page now" className="thumb max-w-[180px] mx-auto rounded-lg" style={{ width: 180 }} />
                  <figcaption className="font-hand text-sm text-[var(--ink-soft)]">first page now</figcaption>
                </figure>
                <figure className="text-center">
                  <img
                    src={thumb}
                    alt={`First page after ${deg}° rotation`}
                    className="thumb max-w-[180px] mx-auto rounded-lg"
                    style={{ width: 180, transform: `rotate(${deg}deg)`, transition: 'transform .2s' }}
                  />
                  <figcaption className="font-hand text-sm text-[var(--ink-soft)]">after {deg}° ↻</figcaption>
                </figure>
              </div>
            )}

            <fieldset className="border-0 m-0 p-0">
              <legend className="font-display font-extrabold text-lg mb-2">Rotation</legend>
              <div className="grid grid-cols-3 gap-2">
                {ANGLES.map((a) => (
                  <label key={a.deg} className={`rad bg-white/60 rounded-xl px-3 py-3 text-center ${deg === a.deg ? 'outline outline-3 outline-[var(--orange)]' : ''}`}>
                    <input type="radio" name="deg" checked={deg === a.deg} onChange={() => setDeg(a.deg)} disabled={busy} />
                    <span className="box" />
                    <span className="font-display font-extrabold text-xl block">{a.deg}°</span>
                    <span className="font-hand text-sm text-[var(--ink-soft)]">{a.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {busy ? (
              <ProgressBar label="Rotating every page…" />
            ) : (
              <button className="btn btn-blue btn-lg w-full" onClick={run}>
                <RotateAllIcon size={22} /> Rotate all {rec.pages} pages
              </button>
            )}
            {err && <ErrorState message={err} onRetry={run} />}
          </div>
        )}

        {result && (
          <div className="space-y-5 text-center">
            <SuccessBanner>Rotated {result.pages} pages by {deg}°</SuccessBanner>
            <div className="flex justify-center"><DownloadButtons rec={result} /></div>
            <div className="flex justify-center gap-3">
              <button className="btn btn-white" onClick={() => { setResult(null); clear(); }}>Rotate another PDF</button>
              <button className="btn btn-white" onClick={() => setResult(null)}>Rotate again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
