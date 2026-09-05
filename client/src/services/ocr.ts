import { createWorker } from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { openPdf, renderPageToCanvas } from './pdfjs';
import { enhanceCanvas, type EnhanceOpts } from './improc';
import { pdfBytes } from './pdfops';

const BASE = import.meta.env.BASE_URL || '/';
const OCR_DPI_SCALE = 2; // 144 dpi — good OCR accuracy, sane memory use

interface WordBox {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrProgress {
  stage: string;
  page: number;
  totalPages: number;
  percent: number;
}

export interface OcrResult {
  blob: Blob;
  pages: number;
  text: string; // all pages joined, with page markers
  searchable: boolean;
}

/**
 * The dev/preview SPA fallback answers missing files with index.html + HTTP 200,
 * so a bare ok/HEAD check is fooled. Validate content-type and size.
 */
async function hasLocalLang(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}tessdata/eng.traineddata.gz`, { method: 'HEAD' });
    if (!r.ok) return false;
    const type = r.headers.get('content-type') || '';
    const len = Number(r.headers.get('content-length') || '0');
    return !type.includes('text/html') && len > 500_000;
  } catch {
    return false;
  }
}

/** Attempt chain: vendored language data → jsdelivr CDN → bare defaults. */
async function makeWorker(onProgress?: (p: OcrProgress) => void): Promise<Worker> {
  const attempts: Record<string, unknown>[] = [];
  if (await hasLocalLang()) {
    attempts.push({
      workerPath: `${BASE}tess/worker.min.js`,
      corePath: `${BASE}tess`,
      langPath: `${BASE}tessdata`,
      gzip: true,
      cacheMethod: 'none',
    });
  }
  attempts.push({
    workerPath: `${BASE}tess/worker.min.js`,
    corePath: `${BASE}tess`,
    langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int',
    gzip: true,
    cacheMethod: 'none',
  });
  attempts.push({ cacheMethod: 'none' });

  let lastErr: unknown = null;
  for (const opts of attempts) {
    try {
      const worker = await createWorker('eng', 1, {
        ...opts,
        logger: (m: { status?: string; progress?: number }) => {
          if (onProgress && m.status && m.status !== 'recognizing text') {
            onProgress({ stage: m.status, page: 0, totalPages: 0, percent: Math.round((m.progress || 0) * 100) });
          }
        },
      } as Parameters<typeof createWorker>[2]);
      return worker;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('OCR engine could not start.');
}

function harvestWords(data: { blocks?: unknown; words?: unknown }): WordBox[] {
  const words: WordBox[] = [];
  const push = (w: { text?: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }) => {
    const t = (w.text || '').trim();
    if (t && w.bbox && w.bbox.x1 > w.bbox.x0) words.push({ text: t, ...w.bbox });
  };
  const blocks = data.blocks as
    | { paragraphs?: { lines?: { words?: Parameters<typeof push>[0][] }[] }[] }[]
    | undefined;
  if (blocks?.length) {
    for (const b of blocks) for (const p of b.paragraphs || []) for (const l of p.lines || []) for (const w of l.words || []) push(w);
  }
  if (!words.length && Array.isArray(data.words)) {
    for (const w of data.words as Parameters<typeof push>[0][]) push(w);
  }
  return words;
}

/**
 * Enhance (optionally) + OCR every page, then rebuild the PDF:
 * full-page JPEG + invisible, positionally-accurate Helvetica text layer.
 */
export async function runOcr(
  bytes: Uint8Array,
  opts: EnhanceOpts & { ocr: boolean },
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  const src = await openPdf(bytes);
  const out = await PDFDocument.create();
  const font = opts.ocr ? await out.embedFont(StandardFonts.Helvetica) : null;
  let worker: Worker | null = null;
  const pageTexts: string[] = [];
  try {
    if (opts.ocr) {
      onProgress?.({ stage: 'Starting OCR engine…', page: 0, totalPages: src.numPages, percent: 1 });
      worker = await makeWorker(onProgress);
    }
    for (let p = 1; p <= src.numPages; p++) {
      onProgress?.({
        stage: `Rendering page ${p} of ${src.numPages}…`,
        page: p,
        totalPages: src.numPages,
        percent: Math.round(((p - 1) / src.numPages) * 100),
      });
      const page = await src.getPage(p);
      const vp1 = page.getViewport({ scale: 1 });
      const canvas = await renderPageToCanvas(src, p, OCR_DPI_SCALE);
      const enhanced = enhanceCanvas(canvas, {
        deskew: opts.deskew,
        denoise: opts.denoise,
        contrast: opts.contrast,
        sharpen: opts.sharpen,
        readability: opts.readability,
      });
      const jpg = await new Promise<Blob | null>((r) => enhanced.toBlob(r, 'image/jpeg', 0.85));
      if (!jpg) throw new Error(`Page ${p} could not be processed.`);
      const embedded = await out.embedJpg(await jpg.arrayBuffer());
      const newPage = out.addPage([vp1.width, vp1.height]);
      newPage.drawImage(embedded, { x: 0, y: 0, width: vp1.width, height: vp1.height });

      if (worker) {
        onProgress?.({ stage: `Reading page ${p} of ${src.numPages}…`, page: p, totalPages: src.numPages, percent: Math.round(((p - 0.5) / src.numPages) * 100) });
        const { data } = await worker.recognize(enhanced, {}, { text: true, blocks: true });
        pageTexts.push(data.text || '');
        const sx = vp1.width / enhanced.width;
        const sy = vp1.height / enhanced.height;
        for (const w of harvestWords(data)) {
          const x = w.x0 * sx;
          const yTop = w.y0 * sy;
          const hPt = Math.max(2, (w.y1 - w.y0) * sy);
          const guess = hPt * 0.9;
          let natural = 1;
          try {
            natural = font!.widthOfTextAtSize(w.text, guess) || 1;
          } catch {
            continue; // unencodable glyph — skip silently
          }
          const factor = Math.min(2.2, Math.max(0.45, (w.x1 - w.x0) * sx / natural));
          const size = Math.max(2, guess * factor);
          try {
            newPage.drawText(w.text, {
              x,
              y: vp1.height - yTop - hPt * 0.85,
              size,
              font: font!,
              color: rgb(0, 0, 0),
              opacity: 0,
            });
          } catch {
            /* skip words pdf-lib cannot encode */
          }
        }
      }
      page.cleanup();
      canvas.width = canvas.height = 0;
      if (enhanced !== canvas) {
        enhanced.width = enhanced.height = 0;
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    const saved = await out.save({ useObjectStreams: true });
    onProgress?.({ stage: 'Done', page: src.numPages, totalPages: src.numPages, percent: 100 });
    return {
      blob: pdfBytes(saved),
      pages: out.getPageCount(),
      text: pageTexts.map((t, i) => `— Page ${i + 1} —\n${t.trim()}`).join('\n\n'),
      searchable: !!worker,
    };
  } finally {
    if (worker) await worker.terminate();
    void src.destroy();
  }
}
