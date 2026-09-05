import * as pdfjsLib from 'pdfjs-dist';
// Vite resolves the worker as a hashed static asset — same-origin in production.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const BASE = import.meta.env.BASE_URL || '/';

export type PdfjsDoc = pdfjsLib.PDFDocumentProxy;

/** Opens a PDF with pdf.js (worker + cmaps + standard fonts, all same-origin). */
export function openPdf(data: Uint8Array | ArrayBuffer): Promise<PdfjsDoc> {
  const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data);
  return pdfjsLib.getDocument({
    data: bytes,
    cMapUrl: `${BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${BASE}standard_fonts/`,
    isEvalSupported: false,
  }).promise;
}

/** Renders one page to a canvas at the given scale (rotation is applied).
 *  `extraRotate` adds user-requested degrees on top of the page's own rotation. */
export async function renderPageToCanvas(
  doc: PdfjsDoc,
  pageNum: number, // 1-based
  scale: number,
  canvas?: HTMLCanvasElement,
  extraRotate = 0,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNum);
  const rotation = (((page.rotate + extraRotate) % 360) + 360) % 360;
  const viewport = page.getViewport({ scale, rotation });
  const c = canvas ?? document.createElement('canvas');
  c.width = Math.max(1, Math.floor(viewport.width));
  c.height = Math.max(1, Math.floor(viewport.height));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return c;
}

/** Small JPEG/PNG data-URL thumbnail for previews. */
export async function renderThumb(doc: PdfjsDoc, pageNum: number, width = 170): Promise<string> {
  const page = await doc.getPage(pageNum);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = width / vp1.width;
  const canvas = await renderPageToCanvas(doc, pageNum, scale);
  page.cleanup();
  return canvas.toDataURL('image/jpeg', 0.7);
}
