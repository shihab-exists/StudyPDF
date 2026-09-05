import { Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from 'docx';
import { openPdf, renderPageToCanvas } from './pdfjs';
import { analyzePdf } from './pdfops';
import { runOcr } from './ocr';

export interface WordProgress {
  stage: string;
  page: number;
  totalPages: number;
  percent: number;
}

export interface WordResult {
  blob: Blob;
  pages: number;
  ocrUsed: boolean;
  images: number;
  paragraphs: number;
}

interface Run {
  str: string;
  size: number;
  bold: boolean;
  italic: boolean;
}
interface Line {
  y: number;
  x: number;
  size: number;
  runs: Run[];
}
interface TextBlock {
  y: number;
  kind: 'text';
  lines: Line[];
}
interface ImageBlock {
  y: number;
  kind: 'image';
  dataUrl: string;
  wPt: number;
  hPt: number;
}
type Block = TextBlock | ImageBlock;

const PX_PER_PT = 96 / 72;
const MAX_DOCX_IMAGES = 300; // memory guard for image-heavy PDFs

/** pdf.js embedded image → small JPEG data-URL (RGBA/RGB/GRAY/bitmap aware). */
function imgToJpegUrl(img: { data?: Uint8ClampedArray<ArrayBuffer>; bitmap?: ImageBitmap; width: number; height: number; kind?: number }, maxDim = 1600): string | null {
  try {
    const w = img.width;
    const h = img.height;
    if (!w || !h) return null;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext('2d')!;
    if (img.bitmap) {
      ctx.drawImage(img.bitmap, 0, 0, c.width, c.height);
    } else if (img.data) {
      let rgba: Uint8ClampedArray<ArrayBuffer>;
      if (img.kind === 3) {
        rgba = img.data;
      } else if (img.kind === 2) {
        rgba = new Uint8ClampedArray(w * h * 4);
        for (let i = 0, j = 0; i < w * h; i++) {
          rgba[j++] = img.data[i * 3];
          rgba[j++] = img.data[i * 3 + 1];
          rgba[j++] = img.data[i * 3 + 2];
          rgba[j++] = 255;
        }
      } else {
        rgba = new Uint8ClampedArray(w * h * 4);
        for (let i = 0, j = 0; i < w * h; i++) {
          const g = img.data[i];
          rgba[j++] = g;
          rgba[j++] = g;
          rgba[j++] = g;
          rgba[j++] = 255;
        }
      }
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      tmp.getContext('2d')!.putImageData(new ImageData(rgba, w, h), 0, 0);
      ctx.drawImage(tmp, 0, 0, c.width, c.height);
    } else {
      return null;
    }
    return c.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

function lineText(l: Line): string {
  return l.runs.map((r) => r.str).join('').trim();
}

/** Group pdf.js text items into lines, then lines into paragraph blocks. */
function linesToBlocks(lines: Line[]): TextBlock[] {
  if (!lines.length) return [];
  // body size = length-weighted mode of run sizes
  const buckets = new Map<number, number>();
  for (const l of lines) {
    for (const r of l.runs) {
      const k = Math.round(r.size * 2) / 2;
      buckets.set(k, (buckets.get(k) ?? 0) + r.str.length);
    }
  }
  let body = 11;
  let best = -1;
  for (const [k, v] of buckets) {
    if (v > best) {
      best = v;
      body = k;
    }
  }
  const blocks: TextBlock[] = [];
  let cur: Line[] = [];
  const flush = () => {
    if (cur.length) blocks.push({ y: cur[0].y, kind: 'text', lines: cur });
    cur = [];
  };
  lines.forEach((l, i) => {
    if (!lineText(l)) return;
    const prev = cur[cur.length - 1];
    if (prev) {
      const gap = prev.y - l.y;
      const sizeJump = Math.abs(l.size - prev.size) > 1.5;
      const indentJump = Math.abs(l.x - prev.x) > 14;
      const headingish = l.size >= body * 1.2 && lineText(l).length < 120;
      const prevHeading = prev.size >= body * 1.2 && lineText(prev).length < 120;
      if (gap > prev.size * 2.4 || sizeJump || indentJump || headingish || prevHeading) flush();
    }
    cur.push(l);
    void i;
  });
  flush();
  (blocks as TextBlock[] & { body?: number }).body = body;
  return blocks;
}

function blockToParagraph(b: TextBlock, body: number, pageBreak: boolean): Paragraph {
  const text = b.lines.map(lineText).join(' ').trim();
  const size = Math.max(...b.lines.map((l) => l.size));
  const boldRuns = b.lines.flatMap((l) => l.runs).filter((r) => r.str.trim()).length
    ? b.lines.flatMap((l) => l.runs).filter((r) => r.str.trim()).every((r) => r.bold)
    : false;
  const isHeading = size >= body * 1.2 && text.length < 120;
  if (isHeading) {
    return new Paragraph({
      heading: size >= body * 1.45 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
      pageBreakBefore: pageBreak,
      children: [new TextRun({ text, bold: true })],
    });
  }
  return new Paragraph({
    pageBreakBefore: pageBreak,
    spacing: { after: 120 },
    children: b.lines.flatMap((l) =>
      l.runs.map((r) => new TextRun({ text: r.str, bold: r.bold || boldRuns, italics: r.italic })),
    ),
  });
}

function imageParagraph(b: ImageBlock, pageBreak: boolean): Paragraph {
  const maxW = 600;
  const wPx = b.wPt * PX_PER_PT;
  const hPx = b.hPt * PX_PER_PT;
  const scale = Math.min(1, maxW / Math.max(wPx, 1));
  return new Paragraph({
    pageBreakBefore: pageBreak,
    spacing: { after: 120 },
    children: [
      new ImageRun({
        type: 'jpg',
        data: b.dataUrl.split(',')[1],
        transformation: { width: Math.max(8, Math.round(wPx * scale)), height: Math.max(8, Math.round(hPx * scale)) },
      }),
    ],
  });
}

function ocrTextToParagraphs(text: string): Paragraph[] {
  const pages = text.split(/— Page \d+ —/).filter((s) => s.trim());
  const out: Paragraph[] = [];
  pages.forEach((pg, pi) => {
    const paras = pg
      .split(/\n{2,}/)
      .map((s) => s.replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean);
    paras.forEach((t, i) =>
      out.push(new Paragraph({ pageBreakBefore: pi > 0 && i === 0, spacing: { after: 120 }, children: [new TextRun(t)] })),
    );
  });
  return out;
}

/**
 * PDF → editable .docx, fully in the browser.
 *
 * - Text PDFs: pdf.js text items → lines → paragraphs, with heading detection
 *   (font-size vs body size), bold/italic runs, embedded images (positioned by
 *   the page CTM) and one Word page per PDF page.
 * - Scanned PDFs: detected with the existing analyzer, then the existing
 *   tesseract OCR engine supplies the text — we never pretend extraction worked.
 */
export async function pdfToWord(bytes: Uint8Array, onProgress?: (p: WordProgress) => void): Promise<WordResult> {
  const analysis = await analyzePdf(bytes);
  const total = analysis.pages;

  if (!analysis.searchable) {
    onProgress?.({ stage: 'Scanned PDF detected — reading pages with OCR…', page: 0, totalPages: total, percent: 1 });
    const ocr = await runOcr(
      bytes,
      { ocr: true, deskew: true, denoise: true, contrast: true, sharpen: true, readability: false },
      (p) => onProgress?.({ stage: `OCR page ${p.page} of ${p.totalPages}…`, page: p.page, totalPages: p.totalPages, percent: p.percent }),
    );
    const children = ocrTextToParagraphs(ocr.text);
    if (!children.length) throw new Error('OCR could not find any readable text on these pages.');
    const doc = new Document({
      styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
      sections: [{ children }],
    });
    return { blob: await Packer.toBlob(doc), pages: total, ocrUsed: true, images: 0, paragraphs: children.length };
  }

  const src = await openPdf(bytes);
  const OPS = (await import('pdfjs-dist')).OPS;
  const children: Paragraph[] = [];
  let images = 0;
  let paragraphs = 0;
  try {
    for (let p = 1; p <= total; p++) {
      onProgress?.({ stage: `Reading page ${p} of ${total}…`, page: p, totalPages: total, percent: Math.round((p / total) * 90) });
      const page = await src.getPage(p);
      // pdf.js only decodes embedded images once a page is rendered — a tiny
      // scratch render primes page.objs/commonObjs so images can be extracted.
      try {
        const scratch = await renderPageToCanvas(src, p, 0.2);
        scratch.width = 1;
        scratch.height = 1;
      } catch {
        /* text-only pages still work without images */
      }
      const tc = await page.getTextContent();
      const lines: Line[] = [];
      let cur: Line | null = null;
      for (const it of tc.items as Array<{ str?: string; transform: number[]; fontName?: string; hasEOL?: boolean }>) {
        if (typeof it.str !== 'string') continue;
        const size = Math.hypot(it.transform[2], it.transform[3]) || Math.abs(it.transform[3]) || 10;
        const y = it.transform[5];
        const x = it.transform[4];
        const fname = it.fontName ?? '';
        const bold = /bold|black|heavy|semibold/i.test(fname);
        const italic = /italic|oblique/i.test(fname);
        if (!cur || Math.abs(cur.y - y) > 2) {
          if (cur) lines.push(cur);
          cur = { y, x, size, runs: [] };
        }
        cur.runs.push({ str: it.str, size, bold, italic });
        if (it.hasEOL) {
          lines.push(cur);
          cur = null;
        }
      }
      if (cur) lines.push(cur);

      const blocks: Block[] = linesToBlocks(lines);
      const body = (blocks as TextBlock[] & { body?: number }).body ?? 11;

      // Embedded images + placement: walk the operator list with a real CTM
      // stack (save/restore, transform, form XObjects) — pdf.js positions
      // images through concatenated matrices, not a single transform op.
      const opsList = await page.getOperatorList();
      const ID = [1, 0, 0, 1, 0, 0];
      const mul = (m: number[], n: number[]): number[] => [
        m[0] * n[0] + m[1] * n[2],
        m[0] * n[1] + m[1] * n[3],
        m[2] * n[0] + m[3] * n[2],
        m[2] * n[1] + m[3] * n[3],
        m[4] * n[0] + m[5] * n[2] + n[4],
        m[4] * n[1] + m[5] * n[3] + n[5],
      ];
      const stack: number[][] = [];
      let ctm = ID;
      const placed = new Set<string>();
      for (let i = 0; i < opsList.fnArray.length; i++) {
        const fn = opsList.fnArray[i];
        const args = opsList.argsArray[i] as unknown[];
        if (fn === OPS.save) stack.push(ctm);
        else if (fn === OPS.restore) ctm = stack.pop() ?? ID;
        else if (fn === OPS.transform) ctm = mul(args as number[], ctm);
        else if (fn === OPS.paintFormXObjectBegin) {
          stack.push(ctm);
          if (Array.isArray(args[0])) ctm = mul(args[0] as number[], ctm);
        } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ID;
        else if (fn === OPS.paintImageXObject && images < MAX_DOCX_IMAGES) {
          const name = args[0] as string;
          const wPt = Math.hypot(ctm[0], ctm[1]);
          const hPt = Math.hypot(ctm[2], ctm[3]);
          const key = `${name}@${ctm[4].toFixed(0)},${ctm[5].toFixed(0)}`;
          if (placed.has(key)) continue; // same image, same spot — skip duplicate op
          if (wPt < 40 || hPt < 20) continue; // skip bullets/artefacts
          placed.add(key);
          try {
            // Globals (g_*) live in commonObjs; the get-callback fires whenever
            // pdf.js finishes decoding — the timeout guarantees we never hang.
            const store = name.startsWith('g_')
              ? (page.commonObjs as unknown as typeof page.objs)
              : page.objs;
            const img = await Promise.race([
              new Promise<{ data?: Uint8ClampedArray<ArrayBuffer>; bitmap?: ImageBitmap; width: number; height: number; kind?: number } | null>((res) => {
                if (store.has(name)) res(store.get(name) as never);
                else store.get(name, res as never);
              }),
              new Promise<null>((res) => { setTimeout(() => res(null), 4000); }),
            ]);
            if (!img) continue;
            const dataUrl = imgToJpegUrl(img);
            if (!dataUrl) continue;
            blocks.push({ y: ctm[5], kind: 'image', dataUrl, wPt, hPt });
            images++;
          } catch {
            /* skip undecodable image */
          }
        }
      }

      blocks.sort((a, b) => b.y - a.y); // top of page first (pdf y grows upward)
      blocks.forEach((b, bi) => {
        const pageBreak = p > 1 && bi === 0;
        if (b.kind === 'image') children.push(imageParagraph(b, pageBreak));
        else {
          children.push(blockToParagraph(b, body, pageBreak));
          paragraphs++;
        }
      });
      page.cleanup();
    }
  } finally {
    void src.destroy();
  }

  if (!children.length) throw new Error('No text or images could be read from this PDF.');
  onProgress?.({ stage: 'Writing your Word document…', page: total, totalPages: total, percent: 96 });
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(doc);
  onProgress?.({ stage: 'Done', page: total, totalPages: total, percent: 100 });
  return { blob, pages: total, ocrUsed: false, images, paragraphs };
}
