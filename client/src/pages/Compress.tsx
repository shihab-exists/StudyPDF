import React, { useMemo, useState } from 'react';
import UploadBox from '../components/UploadBox';
import PageGrid from '../components/PageGrid';
import { usePdfPreview } from '../hooks/usePdfPreview';
import { identityPages } from '../services/pdfPreview';
import { useFileParam } from '../hooks/useFileParam';
import { baseName, formatBytes, getBlob, saveResult } from '../services/store';
import { blobBytes } from '../services/pdfops';
import { compressPdf, LEVELS } from '../services/compress';
import { friendly } from '../services/errors';
import type { FileRecord } from '../types';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, DownloadButtons, ErrorState, FileRow, SectionTitle, StatBox, SuccessBanner } from '../components/Bits';
import { CompressIcon, Paperclip, Star } from '../components/Doodles';
import { useToast } from '../components/Toasts';

type Level = (typeof LEVELS)[number];

interface Outcome {
  rec: FileRecord;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  lossless: boolean;
}

export default function Compress() {
  const { rec, setRec, clear, loading, error: loadError, retry } = useFileParam();
  const [level, setLevel] = useState<Level>(LEVELS[1]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<Outcome | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pv = usePdfPreview(rec, (m) => toast(m, 'error'));
  const pvPages = useMemo(() => identityPages(rec?.pages ?? 0), [rec?.pages]);
  const toast = useToast();

  const run = async () => {
    if (!rec) return;
    setBusy(true);
    setErr(null);
    setStage('Preparing…');
    try {
      const blob = await getBlob(rec.id);
      if (!blob) throw new Error('That file is no longer in your browser storage.');
      const bytes = await blobBytes(blob);
      const out = await compressPdf(bytes, level, (_p, _t, s) => setStage(s));
      const name = `${baseName(rec.originalName)}_compressed.pdf`;
      const saved = await saveResult(name, out.blob, 'compress', out.pages);
      setResult({
        rec: saved,
        originalSize: out.originalSize,
        compressedSize: out.compressedSize,
        savedPercent: out.savedPercent,
        lossless: out.lossless,
      });
      toast(out.savedPercent > 0 ? `✓ Saved ${out.savedPercent}% (${formatBytes(out.compressedSize)})` : 'PDF was already optimised.', 'ok');
    } catch (e) {
      const msg = friendly(e);
      setErr(msg);
      toast(msg, 'error');
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  return (
    <div className="relative max-w-3xl mx-auto">
      <Star size={30} className="doodle floaty hidden md:block" style={{ top: -12, right: -34, ['--fr' as string]: '8deg' }} />
      <div className="mb-4"><BackToTools /></div>
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, left: 30 }} />
        <SectionTitle>Compress PDF</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">Make your PDF smaller without losing quality.</p>

        {loadError && <ErrorState message={loadError} onRetry={retry} />}

        {!rec && !loadError && (
          <UploadBox onUploaded={setRec} title="Drop your PDF here" subtitle="(Max file size: 100 MB)" />
        )}

        {loading && <ProgressBar label="Loading file info…" />}

        {rec && !result && (
          <div className="space-y-5">
            <div className="bg-white/70 rounded-xl px-4 border-2 border-dashed border-[rgba(18,49,92,.3)]">
              <FileRow
                rec={rec}
                right={
                  <span className="flex gap-2 shrink-0">
                    <button className="btn btn-white btn-sm" onClick={() => void pv.toggle()} disabled={pv.loading}>
                      {pv.loading ? 'Loading…' : pv.open ? 'Hide pages' : '👁 Preview pages'}
                    </button>
                    <button className="btn btn-white btn-sm" onClick={clear}>Change</button>
                  </span>
                }
              />
            </div>

            {pv.open && pv.bytes && (
              <div className="bg-white/60 rounded-xl p-3 border-2 border-dashed border-[rgba(18,49,92,.25)]">
                <p className="font-hand text-sm text-[var(--ink-soft)] mb-2">
                  A peek at the pages — compression always processes the whole file. No fake size estimates: the real
                  saved size is shown immediately after processing, because it depends on your PDF's images.
                </p>
                <PageGrid sources={pv.sources} pages={pvPages} eager={12} />
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <StatBox label="Original File" value={<span className="text-base break-all">{rec.originalName}</span>} />
              <StatBox label="Original Size" value={formatBytes(rec.sizeBytes)} accent="var(--blue-bright)" />
            </div>

            <fieldset className="border-0 m-0 p-0">
              <legend className="font-display font-extrabold text-lg mb-2">Compression</legend>
              <div className="space-y-2">
                {LEVELS.map((l) => (
                  <label key={l.key} className={`rad w-full bg-white/60 rounded-xl px-3 py-2 ${level.key === l.key ? 'outline outline-3 outline-[var(--orange)]' : ''}`}>
                    <input type="radio" name="level" checked={level.key === l.key} onChange={() => setLevel(l)} disabled={busy} />
                    <span className="box" />
                    <span>
                      <span className="font-display font-bold text-lg">{l.label}</span>
                      <span className="block font-hand text-sm text-[var(--ink-soft)]">{l.info}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {busy ? (
              <div className="space-y-2 py-2">
                <ProgressBar label={stage || 'Processing your PDF…'} />
                <p className="font-hand text-[var(--ink-soft)] text-center">Your browser is re-rendering each page — hold on 🍋</p>
              </div>
            ) : (
              <button className="btn btn-yellow btn-lg w-full" onClick={run}><CompressIcon size={22} /> Compress PDF</button>
            )}
            {err && <ErrorState message={err} onRetry={run} />}
          </div>
        )}

        {result && (
          <div className="space-y-5">
            <SuccessBanner>PDF processed successfully</SuccessBanner>
            <div className="grid grid-cols-3 gap-3 text-center">
              <StatBox label="Original" value={formatBytes(result.originalSize)} />
              <StatBox label="Compressed" value={formatBytes(result.compressedSize)} accent="var(--blue-bright)" />
              <StatBox label="Saved" value={`${result.savedPercent}%`} accent={result.savedPercent > 0 ? '#0d6b4e' : '#b07800'} />
            </div>
            {result.savedPercent === 0 && (
              <p className="font-hand text-[var(--ink-soft)] text-center">
                This PDF was already tightly optimised — we kept the better of the two versions.
              </p>
            )}
            <div className="flex justify-center">
              <DownloadButtons rec={result.rec} />
            </div>
            <div className="flex justify-center gap-3">
              <button
                className="btn btn-white"
                onClick={() => {
                  setResult(null);
                  clear();
                }}
              >
                Compress Another
              </button>
              <button className="btn btn-blue" onClick={() => setResult(null)}>
                Try another level
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
