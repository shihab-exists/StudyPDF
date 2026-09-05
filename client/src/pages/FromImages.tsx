import React, { useState } from 'react';
import ImageDropList, { type ImageItem } from '../components/ImageDropList';
import { saveResult } from '../services/store';
import { imagesToPdf, pdfBytes, readImage, sanitizeName } from '../services/pdfops';
import { friendly } from '../services/errors';
import type { FileRecord } from '../types';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, DownloadButtons, ErrorState, SectionTitle, SuccessBanner } from '../components/Bits';
import { FromImagesIcon, Paperclip, Star } from '../components/Doodles';
import { useToast } from '../components/Toasts';

export default function FromImages() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<'a4' | 'fit'>('a4');
  const [margin, setMargin] = useState(24);
  const [name, setName] = useState('StudyPDF_From-Images.pdf');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<FileRecord | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  const run = async () => {
    if (!items.length) return;
    setErr(null);
    setBusy(true);
    try {
      const images = [];
      for (let i = 0; i < items.length; i++) {
        setStage(`Reading image ${i + 1} of ${items.length}…`);
        images.push(await readImage(items[i].file));
      }
      setStage('Building your PDF…');
      const bytes = await imagesToPdf(images, { pageSize, margin });
      const saved = await saveResult(sanitizeName(name.trim() || 'StudyPDF_From-Images.pdf'), pdfBytes(bytes), 'from-images', items.length);
      setResult(saved);
      toast(`✓ ${saved.pages} images became one PDF`, 'ok');
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
        <SectionTitle color="#d63f2c">Images to PDF</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">
          Photos of notes, screenshots, scanned pages — drop them in, drag to order, get one PDF.
        </p>

        {!result && (
          <>
            <ImageDropList items={items} setItems={setItems} />

            {items.length > 0 && (
              <div className="mt-6 space-y-4">
                <fieldset className="border-0 m-0 p-0">
                  <legend className="font-display font-extrabold text-lg mb-2">Page size</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`rad bg-white/60 rounded-xl px-3 py-2 text-center ${pageSize === 'a4' ? 'outline outline-3 outline-[var(--orange)]' : ''}`}>
                      <input type="radio" name="psize" checked={pageSize === 'a4'} onChange={() => setPageSize('a4')} disabled={busy} />
                      <span className="box" />
                      <span className="font-display font-bold text-lg">A4 pages</span>
                      <span className="block font-hand text-sm text-[var(--ink-soft)]">images fitted & centered</span>
                    </label>
                    <label className={`rad bg-white/60 rounded-xl px-3 py-2 text-center ${pageSize === 'fit' ? 'outline outline-3 outline-[var(--orange)]' : ''}`}>
                      <input type="radio" name="psize" checked={pageSize === 'fit'} onChange={() => setPageSize('fit')} disabled={busy} />
                      <span className="box" />
                      <span className="font-display font-bold text-lg">Fit to image</span>
                      <span className="block font-hand text-sm text-[var(--ink-soft)]">each page = image size</span>
                    </label>
                  </div>
                </fieldset>

                {pageSize === 'a4' && (
                  <label className="block max-w-xs">
                    <span className="font-display font-bold text-sm">Margin — {margin} pt</span>
                    <input className="w-full mt-2" type="range" min={0} max={72} value={margin} onChange={(e) => setMargin(Number(e.target.value))} disabled={busy} />
                  </label>
                )}

                <label className="block max-w-sm">
                  <span className="font-display font-bold">Output name</span>
                  <input className="input-paper mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="StudyPDF_From-Images.pdf" disabled={busy} />
                </label>

                {busy ? (
                  <ProgressBar label={stage || 'Creating your PDF…'} />
                ) : (
                  <button className="btn btn-yellow btn-lg w-full" onClick={run}>
                    <FromImagesIcon size={22} /> Create PDF from {items.length} image{items.length === 1 ? '' : 's'}
                  </button>
                )}
                {err && <ErrorState message={err} onRetry={run} />}
              </div>
            )}
          </>
        )}

        {result && (
          <div className="space-y-5 text-center">
            <SuccessBanner>{result.pages} images combined into one PDF</SuccessBanner>
            <div className="flex justify-center"><DownloadButtons rec={result} /></div>
            <button
              className="btn btn-white"
              onClick={() => {
                setResult(null);
                items.forEach((i) => URL.revokeObjectURL(i.url));
                setItems([]);
              }}
            >
              Make another PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
