import React, { useEffect, useState } from 'react';
import UploadBox from '../components/UploadBox';
import { useFileParam } from '../hooks/useFileParam';
import { baseName, downloadBlob, getBlob, saveResult } from '../services/store';
import { analyzePdf, blobBytes, pdfBytes } from '../services/pdfops';
import { runOcr, type OcrProgress } from '../services/ocr';
import { friendly } from '../services/errors';
import type { Analysis, FileRecord } from '../types';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, DownloadButtons, ErrorState, SectionTitle, StatBox, SuccessBanner } from '../components/Bits';
import { OcrIcon, Paperclip, Star } from '../components/Doodles';
import { useToast } from '../components/Toasts';

interface Opts {
  deskew: boolean;
  denoise: boolean;
  contrast: boolean;
  sharpen: boolean;
  orientation: boolean;
  readability: boolean;
  ocr: boolean;
}

const OPT_LABELS: { key: keyof Opts; label: string; hint: string }[] = [
  { key: 'deskew', label: 'Deskew', hint: 'straighten tilted scans' },
  { key: 'denoise', label: 'Remove noise', hint: 'kill speckles & dots' },
  { key: 'contrast', label: 'Improve contrast', hint: 'blacks blacker, whites whiter' },
  { key: 'sharpen', label: 'Sharpen', hint: 'crisper letter edges' },
  { key: 'orientation', label: 'Correct orientation', hint: 'apply stored page rotation' },
  { key: 'readability', label: 'Improve readability', hint: 'grayscale + level stretch for photocopies' },
];

export default function Ocr() {
  const { rec, setRec, clear, loading, error: loadError, retry } = useFileParam();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [opts, setOpts] = useState<Opts>({ deskew: true, denoise: true, contrast: true, sharpen: true, orientation: true, readability: false, ocr: true });
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [result, setResult] = useState<{ rec: FileRecord; ocr: boolean; text: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!rec) {
        setAnalysis(null);
        setResult(null);
        return;
      }
      setAnalyzing(true);
      setAnalysis(null);
      setResult(null);
      try {
        const blob = await getBlob(rec.id);
        if (!blob || cancelled) return;
        const a = await analyzePdf(await blobBytes(blob));
        if (cancelled) return;
        setAnalysis(a);
        setOpts((o) => ({ ...o, ocr: !a.searchable }));
      } catch {
        if (!cancelled) setAnalysis(null);
      } finally {
        if (!cancelled) setAnalyzing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rec?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    if (!rec) return;
    setErr(null);
    setProgress({ stage: 'Starting…', page: 0, totalPages: rec.pages, percent: 1 });
    try {
      const blob = await getBlob(rec.id);
      if (!blob) throw new Error('That file is no longer in your browser storage.');
      const out = await runOcr(await blobBytes(blob), opts, setProgress);
      const name = `${baseName(rec.originalName)}_${opts.ocr ? 'searchable' : 'enhanced'}.pdf`;
      const saved = await saveResult(name, out.blob, opts.ocr ? 'ocr' : 'enhance', out.pages);
      setResult({ rec: saved, ocr: !!opts.ocr, text: out.text });
      toast(`✓ ${saved.originalName} is ready`, 'ok');
      setProgress(null);
    } catch (e) {
      const msg = friendly(e);
      setErr(msg);
      toast(msg, 'error');
      setProgress(null);
    }
  };

  const anyEnhance = opts.deskew || opts.denoise || opts.contrast || opts.sharpen || opts.readability || opts.orientation;

  return (
    <div className="relative max-w-3xl mx-auto">
      <Star size={30} className="doodle floaty hidden md:block" style={{ top: -12, right: -34, ['--fr' as string]: '-10deg' }} />
      <div className="mb-4"><BackToTools /></div>
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-mint t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, left: 30 }} />
        <SectionTitle color="#2eb884">OCR & Enhance</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">
          Turn scanned lecture notes, books and forms into clear, searchable files.
        </p>

        {loadError && <ErrorState message={loadError} onRetry={retry} />}

        {!rec && !loadError && (
          <UploadBox onUploaded={setRec} title="Drop scanned PDF here" subtitle="We'll analyse it first, then enhance + OCR" />
        )}
        {loading && <ProgressBar label="Loading file…" />}

        {rec && !result && (
          <div className="space-y-5">
            <div className="bg-white/70 rounded-xl px-4 border-2 border-dashed border-[rgba(18,49,92,.3)] flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold truncate">{rec.originalName}</p>
              </div>
              <button className="btn btn-white btn-sm" onClick={clear}>Change</button>
            </div>

            {analyzing && <ProgressBar label="Analysing PDF…" blue />}
            {analysis && (
              <div>
                <p className="font-display font-extrabold text-lg mb-2 flex items-center gap-2"><OcrIcon size={24} /> PDF Analysis</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatBox label="Pages" value={analysis.pages} />
                  <StatBox label="Searchable text" value={analysis.searchable ? 'Yes' : 'No'} accent={analysis.searchable ? '#0d6b4e' : '#c23a2b'} />
                  <StatBox label="Scan quality" value={analysis.scanQuality} accent={analysis.scanQuality === 'Good' ? '#0d6b4e' : analysis.scanQuality === 'Low' ? '#c23a2b' : '#b07800'} />
                  <StatBox label="Rotated pages" value={analysis.rotatedPages} accent={analysis.rotatedPages ? '#b07800' : undefined} />
                </div>
              </div>
            )}

            <fieldset className="border-0 m-0 p-0">
              <legend className="font-display font-extrabold text-lg mb-2">Enhancement options</legend>
              <div className="grid sm:grid-cols-2 gap-2">
                {OPT_LABELS.map((o) => (
                  <label key={o.key} className="chk bg-white/60 rounded-xl px-3 py-2">
                    <input type="checkbox" checked={opts[o.key]} onChange={(e) => setOpts((cur) => ({ ...cur, [o.key]: e.target.checked }))} disabled={!!progress} />
                    <span className="box" />
                    <span>
                      <span className="font-display font-bold">{o.label}</span>
                      <span className="block font-hand text-sm text-[var(--ink-soft)]">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <label className="chk bg-[#fff3c9] rounded-xl px-3 py-2.5 mt-3 w-full outline outline-2 outline-[var(--yellow)]">
                <input type="checkbox" checked={opts.ocr} onChange={(e) => setOpts((cur) => ({ ...cur, ocr: e.target.checked }))} disabled={!!progress} />
                <span className="box" />
                <span>
                  <span className="font-display font-extrabold text-lg">Run OCR — make text searchable & selectable</span>
                  <span className="block font-hand text-sm text-[var(--ink-soft)]">Tesseract reads every page and embeds an invisible text layer.</span>
                </span>
              </label>
            </fieldset>

            {progress ? (
              <div className="space-y-2 py-1">
                <ProgressBar percent={progress.percent} label={progress.stage} />
                <p className="font-hand text-sm text-[var(--ink-soft)] text-center">
                  Scans take a little while — your browser renders, cleans and reads each page. Feel free to stare at the bar. 📚
                </p>
              </div>
            ) : (
              <button className="btn btn-mint btn-lg w-full" onClick={run} disabled={!anyEnhance && !opts.ocr}>
                <OcrIcon size={22} /> {opts.ocr ? 'Enhance & OCR' : 'Enhance PDF'}
              </button>
            )}
            {err && <ErrorState message={err} onRetry={run} />}
          </div>
        )}

        {result && (
          <div className="space-y-5 text-center">
            <SuccessBanner>
              {result.ocr ? 'Searchable' : 'Enhanced'} PDF processed successfully — {result.rec.pages} pages
            </SuccessBanner>
            <div className="flex justify-center">
              <DownloadButtons
                rec={result.rec}
                extra={
                  result.ocr ? (
                    <button
                      className="btn btn-white"
                      onClick={() => downloadBlob(new Blob([result.text], { type: 'text/plain' }), `${baseName(result.rec.originalName)}.txt`)}
                    >
                      OCR text (.txt)
                    </button>
                  ) : undefined
                }
              />
            </div>
            <p className="font-hand text-[var(--ink-soft)]">
              Tip: open the PDF and try selecting/copying text — it works now!
            </p>
            <button
              className="btn btn-white"
              onClick={() => {
                setResult(null);
                clear();
              }}
            >
              Process another scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
