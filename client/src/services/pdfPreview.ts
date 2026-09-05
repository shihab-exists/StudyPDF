import { openPdf, renderPageToCanvas, type PdfjsDoc } from './pdfjs';
import type { GridPage } from '../types';

/**
 * Lazy thumbnail renderer shared by every page-preview grid in StudyPDF.
 *
 * - opens each source PDF at most once, and only when a page from it is asked for;
 * - renders strictly ONE page at a time through an internal queue, so a 200-page
 *   document never spawns 200 concurrent canvases (bounded memory);
 * - caches small JPEG data-URLs (~10–20 KB each) and frees every canvas right away;
 * - a page that fails to render resolves to `null` — the grid shows a fallback tile
 *   and the rest of the document keeps working;
 * - `destroy()` releases pdf.js documents (and their worker side) and the cache.
 *
 * Everything happens in the browser via pdf.js — bytes are never uploaded.
 */
/** Cap on cached thumbnails: keeps memory bounded when users page through
 *  many virtual sections of a huge document (eviction is FIFO; a revisited
 *  page is simply re-rendered from the still-open pdf.js document). */
const MAX_THUMB_CACHE = 1200;

export class ThumbSet {
  private docs = new Map<number, Promise<PdfjsDoc>>();
  private cache = new Map<string, string | null>();
  private queue: Promise<void> = Promise.resolve();
  private destroyed = false;

  constructor(
    private sources: Uint8Array[],
    public width = 170,
  ) {}

  private docFor(file: number): Promise<PdfjsDoc> {
    let d = this.docs.get(file);
    if (!d) {
      d = openPdf(this.sources[file]).catch((e) => {
        this.docs.delete(file); // allow a retry later
        throw e;
      });
      this.docs.set(file, d);
    }
    return d;
  }

  /** Resolves with a JPEG data-URL, or `null` when this page cannot be rendered. */
  render(file: number, page: number): Promise<string | null> {
    const key = `${file}:${page}`;
    const hit = this.cache.get(key);
    if (hit !== undefined) return Promise.resolve(hit);
    return new Promise<string | null>((resolve) => {
      this.queue = this.queue.then(async () => {
        if (this.destroyed) {
          resolve(null);
          return;
        }
        const again = this.cache.get(key);
        if (again !== undefined) {
          resolve(again);
          return;
        }
        let url: string | null = null;
        try {
          const doc = await this.docFor(file);
          const p = await doc.getPage(page);
          const vp1 = p.getViewport({ scale: 1 });
          const canvas = await renderPageToCanvas(doc, page, this.width / Math.max(vp1.width, 1));
          url = canvas.toDataURL('image/jpeg', 0.72);
          p.cleanup();
          canvas.width = canvas.height = 0; // free the bitmap immediately
        } catch {
          url = null; // per-page fallback; never crashes the grid
        }
        if (!this.destroyed) {
          this.cache.set(key, url);
          while (this.cache.size > MAX_THUMB_CACHE) {
            const oldest = this.cache.keys().next().value;
            if (oldest === undefined) break;
            this.cache.delete(oldest);
          }
        }
        resolve(url);
      });
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.cache.clear();
    for (const d of this.docs.values()) {
      d.then((doc) => void doc.destroy()).catch(() => {});
    }
    this.docs.clear();
  }
}

/** Identity page list for a document with `n` pages (read-only previews). */
export function identityPages(n: number, file = 0): GridPage[] {
  return Array.from({ length: n }, (_, i) => ({ file, src: i + 1, rotate: 0 }));
}

/** Absolute identity key of a grid page (survives sections AND reordering). */
export function pageKey(p: GridPage): string {
  return `${p.file}:${p.src}`;
}

/** Turns identity-keyed selection into a compact range string, e.g. "2-4, 7".
 *  Page identity comes from the source document (`src`), never from the
 *  current viewing section. */
export function selectedToRanges(pages: GridPage[], selected: ReadonlySet<string>): string {
  const nums = pages.filter((p) => selected.has(pageKey(p))).map((p) => p.src);
  nums.sort((a, b) => a - b);
  if (!nums.length) return '';
  const parts: string[] = [];
  let start = nums[0];
  let prev = nums[0];
  for (const n of nums.slice(1)) {
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = prev = n;
  }
  parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  return parts.join(', ');
}
