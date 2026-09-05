import { PDFDocument, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib';
import type { PDFPage, PDFFont } from '@cantoo/pdf-lib';
import { openPdf, renderPageToCanvas } from './pdfjs';
import type { Analysis } from '../types';

/* ============================ byte/blob helpers ============================ */

export async function loadDoc(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { updateMetadata: false });
}

/** Uint8Array → Blob (fresh ArrayBuffer copy so pdf-lib memory can be freed). */
export function pdfBytes(u8: Uint8Array): Blob {
  const buf = new ArrayBuffer(u8.byteLength);
  new Uint8Array(buf).set(u8);
  return new Blob([buf], { type: 'application/pdf' });
}

export async function docBytes(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true });
}

export async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

export function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'document';
}

/* ================================ analysis ================================ */

/** Real analysis: page count, text presence, rotation, image content. */
export async function analyzePdf(bytes: Uint8Array): Promise<Analysis> {
  const doc = await openPdf(bytes);
  try {
    const pages = doc.numPages;
    const sample = Math.min(pages, 5);
    let textChars = 0;
    let rotatedPages = 0;
    let hasImages = false;
    for (let p = 1; p <= sample; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      textChars += tc.items.reduce((n, it) => n + (('str' in it ? it.str : '') || '').trim().length, 0);
      if (page.rotate !== 0) rotatedPages++;
      if (!hasImages) {
        try {
          const ops = await page.getOperatorList();
          const OPS = (await import('pdfjs-dist')).OPS;
          hasImages = ops.fnArray.some(
            (fn) =>
              fn === OPS.paintImageXObject ||
              fn === OPS.paintInlineImageXObject ||
              (OPS as unknown as Record<string, number>).paintXObject === fn,
          );
        } catch {
          /* operator list unavailable — keep false */
        }
      }
      page.cleanup();
    }
    const avg = textChars / sample;
    const searchable = avg >= 20;
    // count rotated pages across the whole doc cheaply
    if (pages > sample) {
      for (let p = sample + 1; p <= pages; p++) {
        const page = await doc.getPage(p);
        if (page.rotate !== 0) rotatedPages++;
        page.cleanup();
      }
    }
    const scanQuality: Analysis['scanQuality'] = !hasImages && searchable ? 'Good' : searchable ? 'Medium' : hasImages ? 'Low' : 'Low';
    return { pages, searchable, textChars, rotatedPages, scanQuality, hasImages, estimatedDpi: null };
  } finally {
    void doc.destroy();
  }
}

/* ============================ page manipulation =========================== */

export interface PageOp {
  page: number; // 0-based source index
  rotate: number; // additional degrees
}

/**
 * Shared page engine used by Page Manager, Rotate All, Split and Extract:
 * copies the selected pages (in order) into a new document and applies rotation.
 */
export async function applyPageOps(bytes: Uint8Array, ops: PageOp[]): Promise<Uint8Array> {
  if (!ops.length) throw new Error('No pages selected.');
  const src = await loadDoc(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, ops.map((o) => o.page));
  copied.forEach((page, i) => {
    const extra = ops[i].rotate % 360;
    if (extra) page.setRotation(degrees((page.getRotation().angle + extra + 360) % 360));
    out.addPage(page);
  });
  return docBytes(out);
}

/** Size in pt of the first page — used to scale preview overlays (watermark,
 *  page numbers) so they match the real stamped configuration proportionally. */
export async function firstPageSize(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  const doc = await loadDoc(bytes);
  const { width, height } = doc.getPage(0).getSize();
  return { width: width || 595, height: height || 842 };
}

export async function pageCount(bytes: Uint8Array): Promise<number> {
  const doc = await loadDoc(bytes);
  return doc.getPageCount();
}

/** Merge many PDFs (in order) into one. */
export async function mergePdfs(list: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of list) {
    const src = await loadDoc(bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  if (out.getPageCount() === 0) throw new Error('Nothing to merge.');
  return docBytes(out);
}

export interface MergeOp {
  file: number; // index into `sources`
  page: number; // 1-based page in that source
  rotate?: number; // extra degrees
}

/**
 * Page-level merge: builds the output from an explicit (possibly reordered,
 * filtered, rotated) list of pages across several source PDFs. Used by the
 * Merge tool's "preview & arrange" grid — the arranged order is the real order.
 */
export async function mergePageOps(sources: Uint8Array[], ops: MergeOp[]): Promise<Uint8Array> {
  if (!ops.length) throw new Error('Nothing to merge.');
  const out = await PDFDocument.create();
  const slots: (PDFPage | null)[] = new Array(ops.length).fill(null);
  const byFile = new Map<number, number[]>();
  ops.forEach((o, i) => {
    const l = byFile.get(o.file) ?? [];
    l.push(i);
    byFile.set(o.file, l);
  });
  for (const [file, idxs] of byFile) {
    const bytes = sources[file];
    if (!bytes) throw new Error(`Source file #${file + 1} is missing.`);
    const src = await loadDoc(bytes);
    const copied = await out.copyPages(src, idxs.map((i) => ops[i].page - 1));
    copied.forEach((pg, k) => {
      slots[idxs[k]] = pg;
    });
  }
  ops.forEach((o, i) => {
    const pg = slots[i];
    if (!pg) throw new Error(`Page ${o.page} could not be copied.`);
    const extra = (o.rotate ?? 0) % 360;
    if (extra) pg.setRotation(degrees((pg.getRotation().angle + extra + 360) % 360));
    out.addPage(pg);
  });
  if (out.getPageCount() === 0) throw new Error('Nothing to merge.');
  return docBytes(out);
}

/* ================================== split ================================= */

/** Parses "1-5, 6-10\n11-20" into [[1..5],[6..10],[11..20]]. */
export function parseRanges(input: string, max: number): number[][] {
  const parts = input
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) throw new Error('Type at least one range, like 1-5.');
  const out: number[][] = [];
  for (const part of parts) {
    const m = part.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    const single = part.match(/^(\d+)$/);
    let a: number;
    let b: number;
    if (m) {
      a = Number(m[1]);
      b = Number(m[2]);
    } else if (single) {
      a = b = Number(single[1]);
    } else {
      throw new Error(`"${part}" is not a valid range. Try 1-5 or 7.`);
    }
    if (a < 1 || b < 1 || a > max || b > max) throw new Error(`Range "${part}" is outside 1-${max}.`);
    if (a > b) throw new Error(`Range "${part}" goes backwards.`);
    out.push(Array.from({ length: b - a + 1 }, (_, i) => a + i));
  }
  return out;
}

export interface SplitPart {
  label: string; // e.g. "pages_1-5"
  fileName: string;
  pages: number;
  blob: Blob;
}

/** Splits into one PDF per range (or per page when ranges = each single page). */
export async function splitPdf(bytes: Uint8Array, ranges: number[][], baseName: string): Promise<SplitPart[]> {
  const parts: SplitPart[] = [];
  for (const range of ranges) {
    const out = await applyPageOps(bytes, range.map((p) => ({ page: p - 1, rotate: 0 })));
    const label = range.length === 1 ? `page_${range[0]}` : `pages_${range[0]}-${range[range.length - 1]}`;
    parts.push({
      label,
      fileName: `${baseName}_${label}.pdf`,
      pages: range.length,
      blob: pdfBytes(out),
    });
  }
  return parts;
}

/* ============================= page numbers =============================== */

export type CornerPos = 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br';

export interface NumberOpts {
  position: CornerPos;
  start: number;
  size: number;
  margin: number;
}

export async function addPageNumbers(bytes: Uint8Array, opts: NumberOpts): Promise<Uint8Array> {
  const doc = await loadDoc(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    const { width: w, height: h } = page.getSize();
    const text = String(opts.start + i);
    const tw = font.widthOfTextAtSize(text, opts.size);
    const top = opts.position.startsWith('t');
    const align = opts.position[1];
    const x = align === 'l' ? opts.margin : align === 'r' ? w - opts.margin - tw : (w - tw) / 2;
    const y = top ? h - opts.margin - opts.size : opts.margin;
    page.drawText(text, { x, y, size: opts.size, font, color: rgb(0.07, 0.19, 0.36) });
  });
  return docBytes(doc);
}

/* ================================ watermark =============================== */

export interface WatermarkOpts {
  text: string;
  size: number;
  rotate: number; // degrees
  opacity: number; // 0..1
  color: { r: number; g: number; b: number };
  position: 'center' | 'top' | 'bottom';
}

export async function watermarkPdf(bytes: Uint8Array, opts: WatermarkOpts): Promise<Uint8Array> {
  if (!opts.text.trim()) throw new Error('Watermark text is empty.');
  const doc = await loadDoc(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.getPages().forEach((page) => {
    const { width: w, height: h } = page.getSize();
    const tw = font.widthOfTextAtSize(opts.text, opts.size);
    const y = opts.position === 'top' ? h - opts.size * 1.6 : opts.position === 'bottom' ? opts.size * 0.8 : (h - opts.size) / 2;
    page.drawText(opts.text, {
      x: (w - tw * Math.cos((opts.rotate * Math.PI) / 180)) / 2,
      y,
      size: opts.size,
      font,
      color: rgb(opts.color.r, opts.color.g, opts.color.b),
      opacity: opts.opacity,
      rotate: degrees(opts.rotate),
    });
  });
  return docBytes(doc);
}

/* ============================== images → pdf ============================== */

export interface ImageInput {
  data: Uint8Array;
  fmt: 'png' | 'jpg';
  width: number;
  height: number;
}

export interface Img2PdfOpts {
  pageSize: 'a4' | 'fit';
  margin: number;
}

export async function imagesToPdf(images: ImageInput[], opts: Img2PdfOpts): Promise<Uint8Array> {
  if (!images.length) throw new Error('Add at least one image.');
  const doc = await PDFDocument.create();
  for (const img of images) {
    const embedded = img.fmt === 'png' ? await doc.embedPng(img.data) : await doc.embedJpg(img.data);
    let pageW: number;
    let pageH: number;
    if (opts.pageSize === 'fit') {
      // image pixels → points at 96 dpi
      pageW = (img.width * 72) / 96;
      pageH = (img.height * 72) / 96;
    } else {
      pageW = 595.28; // A4 portrait
      pageH = 841.89;
    }
    const page = doc.addPage([pageW, pageH]);
    const m = opts.pageSize === 'a4' ? opts.margin : 0;
    const availW = pageW - m * 2;
    const availH = pageH - m * 2;
    const scale = Math.min(availW / embedded.width, availH / embedded.height);
    const dw = embedded.width * scale;
    const dh = embedded.height * scale;
    page.drawImage(embedded, { x: (pageW - dw) / 2, y: (pageH - dh) / 2, width: dw, height: dh });
  }
  return docBytes(doc);
}

/* =============================== extract text ============================= */

export interface PageText {
  page: number;
  text: string;
}

/** Text extraction with simple layout reconstruction (lines by y-coordinate). */
export async function extractPdfText(bytes: Uint8Array): Promise<PageText[]> {
  const doc = await openPdf(bytes);
  try {
    const out: PageText[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      type TI = { str: string; transform: number[]; height?: number };
      const items = (tc.items as unknown as TI[])
        .filter((it) => typeof it.str === 'string' && it.str.length > 0 && Array.isArray(it.transform))
        .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], h: it.height || Math.hypot(it.transform[2], it.transform[3]) || 10 }));
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const lines: string[] = [];
      let cur: typeof items = [];
      let curY = Number.NaN;
      const flush = () => {
        if (cur.length) {
          cur.sort((a, b) => a.x - b.x);
          let line = '';
          let prevEnd = -Infinity;
          for (const it of cur) {
            if (line && it.x - prevEnd > it.h * 0.35) line += ' ';
            line += it.str;
            prevEnd = it.x + it.h * 0.5 * Math.max(1, it.str.length * 0.55);
          }
          lines.push(line.trimEnd());
        }
        cur = [];
      };
      for (const it of items) {
        if (cur.length && Math.abs(it.y - curY) > Math.max(3, it.h * 0.6)) flush();
        cur.push(it);
        curY = cur.length === 1 ? it.y : curY;
      }
      flush();
      out.push({ page: p, text: lines.join('\n') });
      page.cleanup();
    }
    return out;
  } finally {
    void doc.destroy();
  }
}

/* ================================= pdf info =============================== */

export interface PdfInfoResult {
  version: string;
  pages: number;
  sizes: { w: number; h: number }[]; // unique page sizes (pt)
  uniform: boolean;
  meta: Record<string, string>;
  analysis: Analysis;
}

function fmtDate(raw?: string): string {
  if (!raw) return '';
  const m = raw.match(/^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return raw;
  return `${m[1]}-${m[2] || '01'}-${m[3] || '01'} ${m[4] || '00'}:${m[5] || '00'}`;
}

export async function getPdfInfo(bytes: Uint8Array): Promise<PdfInfoResult> {
  const [pj, analysis] = await Promise.all([openPdf(bytes), analyzePdf(bytes)]);
  try {
    const md = (await pj.getMetadata()) as unknown as { info?: Record<string, unknown> };
    const info = md.info ?? {};
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
    const sizes: { w: number; h: number }[] = [];
    for (let p = 1; p <= pj.numPages; p++) {
      const page = await pj.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const w = Math.round(vp.width);
      const h = Math.round(vp.height);
      if (!sizes.some((s) => Math.abs(s.w - w) < 2 && Math.abs(s.h - h) < 2)) sizes.push({ w, h });
      page.cleanup();
    }
    return {
      version: str(info.PDFFormatVersion) || 'unknown',
      pages: pj.numPages,
      sizes,
      uniform: sizes.length <= 1,
      meta: {
        Title: str(info.Title),
        Author: str(info.Author),
        Subject: str(info.Subject),
        Keywords: str(info.Keywords),
        Creator: str(info.Creator),
        Producer: str(info.Producer),
        Created: fmtDate(str(info.CreationDate)),
        Modified: fmtDate(str(info.ModDate)),
      },
      analysis,
    };
  } finally {
    void pj.destroy();
  }
}

/* ============================== pdf → images ============================== */

export interface RenderedImage {
  fileName: string;
  blob: Blob;
  url: string; // object URL for preview
  width: number;
  height: number;
}

export async function pdfToImages(
  bytes: Uint8Array,
  opts: { fmt: 'png' | 'jpg'; quality: number; scale: number; baseName: string; only?: number[] },
  onProgress?: (page: number, total: number) => void,
): Promise<RenderedImage[]> {
  const doc = await openPdf(bytes);
  try {
    const nums = opts.only?.length
      ? [...new Set(opts.only)].filter((n) => n >= 1 && n <= doc.numPages).sort((a, b) => a - b)
      : Array.from({ length: doc.numPages }, (_, i) => i + 1);
    if (!nums.length) throw new Error('No valid pages selected.');
    const out: RenderedImage[] = [];
    for (let k = 0; k < nums.length; k++) {
      const p = nums[k];
      const canvas = await renderPageToCanvas(doc, p, opts.scale);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, opts.fmt === 'png' ? 'image/png' : 'image/jpeg', opts.quality),
      );
      if (!blob) throw new Error(`Could not render page ${p}.`);
      const w = canvas.width;
      const h = canvas.height;
      canvas.width = canvas.height = 0; // free the full-res bitmap right away
      out.push({
        fileName: `${opts.baseName}_page-${String(p).padStart(2, '0')}.${opts.fmt}`,
        blob,
        url: URL.createObjectURL(blob),
        width: w,
        height: h,
      });
      onProgress?.(k + 1, nums.length);
    }
    return out;
  } finally {
    void doc.destroy();
  }
}

/* ========================= helpers used by pages ========================== */

export async function pageThumbDataUrl(bytes: Uint8Array, pageNum: number, width = 170): Promise<string> {
  const doc = await openPdf(bytes);
  try {
    const page = await doc.getPage(pageNum);
    const vp1 = page.getViewport({ scale: 1 });
    const canvas = await renderPageToCanvas(doc, pageNum, width / vp1.width);
    page.cleanup();
    return canvas.toDataURL('image/jpeg', 0.72);
  } finally {
    void doc.destroy();
  }
}

export async function readImage(file: File): Promise<ImageInput> {
  const data = new Uint8Array(await file.arrayBuffer());
  const url = URL.createObjectURL(file);
  try {
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('unreadable image'));
      img.src = url;
    });
    const fmt: 'png' | 'jpg' = file.type === 'image/png' || data[0] === 0x89 ? 'png' : 'jpg';
    return { data, fmt, ...dims };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type { PDFPage, PDFFont };
