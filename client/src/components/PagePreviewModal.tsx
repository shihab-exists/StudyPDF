import React, { useEffect, useState } from 'react';
import { openPdf, renderPageToCanvas } from '../services/pdfjs';
import type { GridPage } from '../types';

interface Props {
  sources: Uint8Array[];
  pages: GridPage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}

/**
 * Lightweight full-size preview of one page, opened by clicking a thumbnail.
 * Renders client-side with pdf.js at up to ~980 px wide (never full-res print
 * quality), applies the user's extra rotation, and frees the document on close.
 */
export default function PagePreviewModal({ sources, pages, index, onIndex, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    const p = pages[index];
    if (!p) return;
    (async () => {
      let doc: Awaited<ReturnType<typeof openPdf>> | null = null;
      try {
        doc = await openPdf(sources[p.file]);
        const page = await doc.getPage(p.src);
        const vp1 = page.getViewport({ scale: 1, rotation: (((page.rotate + p.rotate) % 360) + 360) % 360 });
        const scale = Math.min(3, 980 / Math.max(vp1.width, 1));
        const canvas = await renderPageToCanvas(doc, p.src, scale, undefined, p.rotate);
        const data = canvas.toDataURL('image/jpeg', 0.85);
        page.cleanup();
        canvas.width = canvas.height = 0;
        if (!cancelled) setUrl(data);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (doc) void doc.destroy();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [index, pages, sources]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      else if (e.key === 'ArrowRight' && index < pages.length - 1) onIndex(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, pages.length, onIndex, onClose]);

  return (
    <div className="pv-overlay" role="dialog" aria-modal="true" aria-label={`Page ${index + 1} preview`} onClick={onClose}>
      <div className="pv-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p className="font-display font-extrabold flex-1 text-center">
            Page {index + 1} of {pages.length}
          </p>
          <button className="icon-btn" style={{ width: 34, height: 34 }} aria-label="Close preview" onClick={onClose}>
            ✕
          </button>
        </div>
        {url ? (
          <img src={url} alt={`Page ${index + 1} full preview`} />
        ) : failed ? (
          <p className="font-hand text-center text-[#c23a2b] py-10">
            This page could not be rendered — the PDF may be damaged or password protected.
          </p>
        ) : (
          <div className="pv-spin" role="status" aria-label="Rendering preview" />
        )}
        {pages.length > 1 && (
          <div className="flex justify-center gap-3 mt-2">
            <button className="btn btn-white btn-sm" onClick={() => onIndex(index - 1)} disabled={index === 0}>
              ← Previous
            </button>
            <button className="btn btn-white btn-sm" onClick={() => onIndex(index + 1)} disabled={index >= pages.length - 1}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
