import React, { useState } from 'react';
import UploadBox from '../components/UploadBox';
import { useFileParam } from '../hooks/useFileParam';
import { baseName, getBlob, saveResult } from '../services/store';
import { blobBytes, sanitizeName } from '../services/pdfops';
import { pdfToWord } from '../services/toWord';
import { friendly } from '../services/errors';
import type { FileRecord } from '../types';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, DownloadButtons, ErrorState, FileRow, SectionTitle, SuccessBanner } from '../components/Bits';
import { Paperclip, Star, WordDocIcon } from '../components/Doodles';
import { useToast } from '../components/Toasts';

export default function ToWord() {
  const { rec, setRec, clear, loading, error: loadError, retry } = useFileParam();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<{ rec: FileRecord; ocrUsed: boolean; images: number; paragraphs: number } | null>(null);
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
      const out = await pdfToWord(await blobBytes(blob), (p) => setStage(p.stage));
      const name = sanitizeName(`${baseName(rec.originalName)}_word.docx`);
      const saved = await saveResult(name, out.blob, 'word', out.pages);
      setResult({ rec: saved, ocrUsed: out.ocrUsed, images: out.images, paragraphs: out.paragraphs });
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
      <Star size={30} className="doodle floaty hidden md:block" style={{ top: -12, left: -34, ['--fr' as string]: '-7deg' }} />
      <div className="mb-4"><BackToTools /></div>
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-cyan t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, right: 34 }} />
        <SectionTitle color="#1c4fa3">PDF to Word</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">
          Convert PDF files into editable Word documents — text, headings and images, right here in your browser.
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
              Text PDFs keep their paragraphs, headings and pictures. Scanned PDFs are read with StudyPDF's OCR first,
              so conversion can take a few minutes.
            </p>
            {busy ? (
              <div className="space-y-2 py-2">
                <ProgressBar label={stage || 'Converting your PDF…'} />
                <p className="font-hand text-[var(--ink-soft)] text-center">Everything stays on your device 🔒</p>
              </div>
            ) : (
              <button className="btn btn-blue btn-lg w-full" onClick={run}>
                <WordDocIcon size={22} /> Convert to Word
              </button>
            )}
            {err && <ErrorState message={err} onRetry={run} />}
          </div>
        )}

        {result && (
          <div className="space-y-5 text-center">
            <SuccessBanner>
              Word document ready — {result.rec.pages} page{result.rec.pages === 1 ? '' : 's'}
              {result.ocrUsed ? ' (text read with OCR)' : ''}
            </SuccessBanner>
            <p className="font-hand text-[var(--ink-soft)]">
              {result.paragraphs} paragraph{result.paragraphs === 1 ? '' : 's'}
              {result.images ? ` and ${result.images} image${result.images === 1 ? '' : 's'}` : ''} converted.
              Layout is a best-effort copy — check headings and tables after editing.
            </p>
            <div className="flex justify-center">
              <DownloadButtons rec={result.rec} downloadLabel="⬇ Download Word" />
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
