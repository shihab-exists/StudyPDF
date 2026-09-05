import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import UploadBox from '../components/UploadBox';
import { useFileParam } from '../hooks/useFileParam';
import { baseName, downloadBlob, getBlob } from '../services/store';
import { blobBytes, extractPdfText } from '../services/pdfops';
import { friendly } from '../services/errors';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, ErrorState, SectionTitle, SuccessBanner } from '../components/Bits';
import { OcrIcon, Paperclip, Star, TextIcon } from '../components/Doodles';
import { useToast } from '../components/Toasts';

export default function ExtractText() {
  const { rec, setRec, clear, loading, error: loadError, retry } = useFileParam();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [noText, setNoText] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const run = async () => {
    if (!rec) return;
    setErr(null);
    setBusy(true);
    setText(null);
    setNoText(false);
    try {
      const blob = await getBlob(rec.id);
      if (!blob) throw new Error('That file is no longer in your browser storage.');
      const pages = await extractPdfText(await blobBytes(blob));
      const joined = pages.map((p) => `— Page ${p.page} —\n${p.text.trim()}`).join('\n\n');
      const chars = pages.reduce((n, p) => n + p.text.trim().length, 0);
      if (chars < 10) {
        setNoText(true);
      } else {
        setText(joined);
        toast(`✓ Extracted ${chars.toLocaleString()} characters from ${pages.length} pages`, 'ok');
      }
    } catch (e) {
      const msg = friendly(e);
      setErr(msg);
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (text === null) return;
    try {
      await navigator.clipboard.writeText(text);
      toast('✓ Copied to clipboard', 'ok');
    } catch {
      areaRef.current?.select();
      document.execCommand('copy');
      toast('✓ Copied to clipboard', 'ok');
    }
  };

  const download = () => {
    if (text === null || !rec) return;
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${baseName(rec.originalName)}.txt`);
  };

  return (
    <div className="relative max-w-3xl mx-auto">
      <Star size={30} className="doodle floaty hidden md:block" style={{ top: -12, left: -34, ['--fr' as string]: '-8deg' }} />
      <div className="mb-4"><BackToTools /></div>
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, right: 34 }} />
        <SectionTitle color="#b07800">Extract Text</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">
          Pull the real, selectable text out of a PDF — page by page, ready to copy into your notes.
        </p>

        {loadError && <ErrorState message={loadError} onRetry={retry} />}
        {!rec && !loadError && <UploadBox onUploaded={setRec} title="Drop your PDF here" />}
        {loading && <ProgressBar label="Loading file…" />}

        {rec && text === null && !noText && (
          <div className="space-y-5">
            <div className="bg-white/70 rounded-xl px-4 border-2 border-dashed border-[rgba(18,49,92,.3)] flex items-center gap-3 py-2.5">
              <TextIcon size={28} />
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold truncate">{rec.originalName}</p>
                <p className="font-hand text-sm text-[var(--ink-soft)]">{rec.pages} pages</p>
              </div>
              <button className="btn btn-white btn-sm" onClick={clear}>Change</button>
            </div>

            {busy ? (
              <ProgressBar label="Reading your PDF…" blue />
            ) : (
              <button className="btn btn-yellow btn-lg w-full" onClick={run}>
                <TextIcon size={22} /> Extract Text
              </button>
            )}
            {err && <ErrorState message={err} onRetry={run} />}
          </div>
        )}

        {noText && (
          <div className="space-y-4 text-center py-4">
            <div className="flex justify-center"><OcrIcon size={54} /></div>
            <p className="font-display font-extrabold text-xl">This PDF does not contain selectable text. Try OCR &amp; Enhance.</p>
            <p className="font-hand text-[var(--ink-soft)]">It looks like a scan — OCR will read the pages and create real text first.</p>
            <div className="flex justify-center gap-3">
              <Link to={`/ocr?file=${rec?.id ?? ''}`} className="btn btn-mint">Open OCR &amp; Enhance</Link>
              <button className="btn btn-white" onClick={() => { setNoText(false); clear(); }}>Choose another file</button>
            </div>
          </div>
        )}

        {text !== null && (
          <div className="space-y-4">
            <SuccessBanner>Text extracted — {text.length.toLocaleString()} characters</SuccessBanner>
            <textarea
              ref={areaRef}
              className="input-paper font-hand w-full"
              style={{ minHeight: 320, whiteSpace: 'pre-wrap', fontSize: '1rem', lineHeight: 1.5 }}
              readOnly
              value={text}
              aria-label="Extracted text"
            />
            <div className="flex flex-wrap justify-center gap-3">
              <button className="btn btn-blue" onClick={copy}>Copy text</button>
              <button className="btn btn-yellow" onClick={download}>⬇ Download .txt</button>
              <button className="btn btn-white" onClick={run}>Extract again</button>
              <button className="btn btn-white" onClick={() => { setText(null); clear(); }}>Another PDF</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
