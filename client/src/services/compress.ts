import { PDFDocument } from '@cantoo/pdf-lib';
import { openPdf, renderPageToCanvas } from './pdfjs';
import { pdfBytes } from './pdfops';

export interface Level {
  key: 'low' | 'balanced' | 'maximum';
  label: string;
  info: string;
  dpi: number;
  q: number;
}

export const LEVELS: Level[] = [
  { key: 'low', label: 'Low', info: 'Gentle — keeps near-print quality (best for submissions with figures).', dpi: 150, q: 0.8 },
  { key: 'balanced', label: 'Balanced', info: 'Recommended — clearly smaller, still crisp on screen and print.', dpi: 120, q: 0.65 },
  { key: 'maximum', label: 'Maximum', info: 'Smallest file — ideal for email and portal upload limits.', dpi: 96, q: 0.5 },
];

export interface CompressOutcome {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  pages: number;
  lossless: boolean; // true when the original was already smaller
}

/**
 * Real recompression: every page is rendered at the target DPI and re-embedded
 * as JPEG. The result is only used when it is genuinely smaller than the
 * original — savings are never faked.
 */
export async function compressPdf(
  bytes: Uint8Array,
  level: Level,
  onProgress?: (page: number, total: number, stage: string) => void,
): Promise<CompressOutcome> {
  const doc = await openPdf(bytes);
  const out = await PDFDocument.create();
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      onProgress?.(p, doc.numPages, `Re-rendering page ${p} of ${doc.numPages}…`);
      const page = await doc.getPage(p);
      const vp1 = page.getViewport({ scale: 1 });
      const canvas = await renderPageToCanvas(doc, p, level.dpi / 72);
      const jpg = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', level.q));
      if (!jpg) throw new Error(`Page ${p} could not be rendered.`);
      const embedded = await out.embedJpg(await jpg.arrayBuffer());
      const newPage = out.addPage([vp1.width, vp1.height]);
      newPage.drawImage(embedded, { x: 0, y: 0, width: vp1.width, height: vp1.height });
      page.cleanup();
      canvas.width = canvas.height = 0;
      // yield to the UI thread between pages
      await new Promise((r) => setTimeout(r, 0));
    }
    const rebuilt = await out.save({ useObjectStreams: true });
    const rebuiltBlob = pdfBytes(rebuilt);
    const lossless = bytes.byteLength <= rebuiltBlob.size;
    const blob = lossless ? pdfBytes(bytes) : rebuiltBlob;
    const originalSize = bytes.byteLength;
    const compressedSize = blob.size;
    return {
      blob,
      originalSize,
      compressedSize,
      savedPercent: lossless ? 0 : Math.max(0, Math.round((1 - compressedSize / originalSize) * 1000) / 10),
      pages: doc.numPages,
      lossless,
    };
  } finally {
    void doc.destroy();
  }
}
