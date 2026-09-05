import PptxGenJS from 'pptxgenjs';
import { openPdf, renderPageToCanvas } from './pdfjs';

export interface PptxProgress {
  stage: string;
  page: number;
  totalPages: number;
  percent: number;
}

export interface PptxResult {
  blob: Blob;
  slides: number;
}

/**
 * PDF → .pptx, fully in the browser: one slide per PDF page, each slide sized
 * to the first page's real dimensions (points → inches) so the aspect ratio is
 * preserved, with the page rendered as a high-quality raster for pixel-faithful
 * appearance (works for text AND scanned PDFs). Pages with a different size are
 * letterboxed (contain-fit, centred) inside the deck layout.
 */
export async function pdfToPptx(bytes: Uint8Array, onProgress?: (p: PptxProgress) => void): Promise<PptxResult> {
  const doc = await openPdf(bytes);
  try {
    const total = doc.numPages;
    if (!total) throw new Error('This PDF has no pages.');
    const first = await doc.getPage(1);
    const vp1 = first.getViewport({ scale: 1 });
    const W = Math.max(1, vp1.width) / 72; // inches
    const H = Math.max(1, vp1.height) / 72;
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'STUDYPDF', width: W, height: H });
    pptx.layout = 'STUDYPDF';
    pptx.author = 'StudyPDF';
    pptx.title = 'Converted PDF';

    for (let p = 1; p <= total; p++) {
      onProgress?.({ stage: `Rendering page ${p} of ${total}…`, page: p, totalPages: total, percent: Math.round((p / total) * 95) });
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const scale = Math.min(2.2, 2000 / Math.max(vp.width, vp.height));
      const canvas = await renderPageToCanvas(doc, p, scale);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      canvas.width = canvas.height = 0; // free the full-res bitmap immediately
      const slide = pptx.addSlide();
      const pw = vp.width / 72;
      const ph = vp.height / 72;
      if (Math.abs(pw - W) < 0.01 && Math.abs(ph - H) < 0.01) {
        slide.addImage({ data: dataUrl, x: 0, y: 0, w: W, h: H });
      } else {
        // contain-fit pages with a different aspect inside the deck layout
        const s = Math.min(W / pw, H / ph);
        const w = pw * s;
        const h = ph * s;
        slide.background = { color: 'FFFFFF' };
        slide.addImage({ data: dataUrl, x: (W - w) / 2, y: (H - h) / 2, w, h });
      }
      page.cleanup();
    }
    onProgress?.({ stage: 'Writing your PowerPoint…', page: total, totalPages: total, percent: 97 });
    const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
    onProgress?.({ stage: 'Done', page: total, totalPages: total, percent: 100 });
    return { blob, slides: total };
  } finally {
    void doc.destroy();
  }
}
