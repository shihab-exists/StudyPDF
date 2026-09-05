import React, { useState } from 'react';
import UploadBox from '../components/UploadBox';
import { useFileParam } from '../hooks/useFileParam';
import { baseName, getBlob, saveResult } from '../services/store';
import { blobBytes, sanitizeName } from '../services/pdfops';
import { pdfToPptx } from '../services/toPptx';
import { friendly } from '../services/errors';
import type { FileRecord } from '../types';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, DownloadButtons, ErrorState, FileRow, SectionTitle, SuccessBanner } from '../components/Bits';
import { Paperclip, SlidesIcon, Star } from '../components/Doodles';
import { useToast } from '../components/Toasts';

export default function ToPptx() {
  const { rec, setRec, clear, loading, error: loadError, retry } = useFileParam();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<{ rec: FileRecord; slides: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  const run = async () => {
    if (!rec) return;
    setErr(null);
    setBusy(true);
    setStage('Opening your PDF…');
    try {
      const blob = await getBlob(rec.id);
      if (!blob) throw new Error('That file is no longer in your browser storage.');
      const out = await pdfToPptx(await blobBytes(blob), (p) => setStage(p.stage));
      const name = sanitizeName(`${baseName(rec.originalName)}_slides.pptx`);
      const saved = await saveResult(name, out.blob, 'pptx', out.slides);
      setResult({ rec: saved, slides: out.slides });
      toast(`✓ ${saved.originalName} is ready`, 'ok');
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
        <span className="tape t-mint t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, left: 30 }} />
        <SectionTitle color="#d63f2c">PDF to PowerPoint</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">
          Turn PDF pages into PowerPoint slides — one slide per page, looking just like the original.
        </p>

        {loadError && <ErrorState message={loadError} onRetry={retry} />}
        {!rec && !loadError && <UploadBox onUploaded={setRec} title="Drop your PDF here" />}
        {loading && <ProgressBar label="Loading file…" />}

        {rec && !result && (
          <div className="space-y-5">
            <div className="bg-white/70 rounded-xl px-4 border-2 border-dashed border-[rgba(18,49,92,.3)]">
              <FileRow rec={rec} right={<button className="btn btn-white btn-sm" onClick={clear}>Change</button>} />
            </div>
            <p className="font-hand text-sm text-[var(--ink-soft)]">
              Each slide keeps the page's exact look (text, pictures and scans alike) at the original page size.
              Slides are picture-perfect images, so their text is not editable afterwards.
            </p>
            {busy ? (
              <div className="space-y-2 py-2">
                <ProgressBar label={stage || 'Building your slides…'} />
                <p className="font-hand text-[var(--ink-soft)] text-center">Everything stays on your device 🔒</p>
              </div>
            ) : (
              <button className="btn btn-yellow btn-lg w-full" onClick={run}>
                <SlidesIcon size={22} /> Convert to PowerPoint
              </button>
            )}
            {err && <ErrorState message={err} onRetry={run} />}
          </div>
        )}

        {result && (
          <div className="space-y-5 text-center">
            <SuccessBanner>
              PowerPoint ready — {result.slides} slide{result.slides === 1 ? '' : 's'}
            </SuccessBanner>
            <div className="flex justify-center">
              <DownloadButtons rec={result.rec} downloadLabel="⬇ Download PowerPoint" />
            </div>
            <button className="btn btn-white" onClick={() => { setResult(null); clear(); }}>
              Convert another PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
