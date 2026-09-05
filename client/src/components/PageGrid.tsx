import React, { useEffect, useRef, useState } from 'react';
import { ThumbSet, pageKey } from '../services/pdfPreview';
import { SECTION_SIZE, sectionCount, sectionForPage, sectionRange, clampPage } from '../services/sections';
import type { GridPage } from '../types';
import ProgressBar from './ProgressBar';
import PagePreviewModal from './PagePreviewModal';
import { GripIcon, RotateIcon, TrashIcon } from './Doodles';

export interface PageGridProps {
  /** PDF byte sources. Single-document tools pass `[bytes]`; Merge passes one entry per file. */
  sources: Uint8Array[];
  /** Page-operation state (absolute order = output order), owned by the parent tool. */
  pages: GridPage[];
  /** Required for reorder / rotate / delete. The parent decides what the final PDF does. */
  onPagesChange?: (pages: GridPage[]) => void;
  /** Selected page identities (`file:src` keys) — survives sections and reordering. */
  selected?: Set<string>;
  onSelectChange?: (next: Set<string>) => void;
  selectable?: boolean;
  reorderable?: boolean;
  rotatable?: boolean;
  deletable?: boolean;
  /** Thumbnail render width in px — deliberately small; never full resolution. */
  width?: number;
  /** How many thumbnails of the active section to draw immediately. */
  eager?: number;
  /** Optional second line under "Page N" (e.g. source file / result part). */
  subLabel?: (p: GridPage, pos: number) => string | null;
  /** Config-faithful overlay drawn on top of each rendered thumbnail
   *  (watermark text, page numbers…) — same configuration the generator uses. */
  overlay?: (p: GridPage, pos: number) => React.ReactNode;
  disabled?: boolean;
}

/**
 * The ONE reusable PDF page grid used by Page Manager, Split, Merge,
 * PDF→Images, Numbers, Watermark and Compress previews.
 *
 * Virtual sections: documents longer than SECTION_SIZE (100) pages are viewed
 * one section at a time — only the active section exists in the DOM. The
 * underlying pdf.js document (ThumbSet) stays open and its thumbnail cache is
 * shared across sections, so navigating back is cheap. Sections are a viewing
 * window only: labels, selection keys and operations always use ABSOLUTE page
 * identity (`Page 1204` is page 1204 of the original PDF, in any section).
 *
 * Thumbnails render lazily (eager window + IntersectionObserver), one page at
 * a time, at low resolution, as small cached JPEG data-URLs.
 */
export default function PageGrid({
  sources,
  pages,
  onPagesChange,
  selected,
  onSelectChange,
  selectable = false,
  reorderable = false,
  rotatable = false,
  deletable = false,
  width = 170,
  eager = 24,
  subLabel,
  overlay,
  disabled = false,
}: PageGridProps) {
  // Parents may pass inline arrays; keep a stable identity so the renderer
  // is only rebuilt when the actual bytes change.
  const [stableSources, setStableSources] = useState(sources);
  if (stableSources.length !== sources.length || sources.some((s, i) => s !== stableSources[i])) {
    setStableSources(sources);
  }

  const total = pages.length;
  const nSections = sectionCount(total);
  const sectioned = nSections > 1;

  const [section, setSection] = useState(0);
  const [jumpVal, setJumpVal] = useState('');
  const [jumpErr, setJumpErr] = useState<string | null>(null);
  const [focusPos, setFocusPos] = useState<number | null>(null);

  // keep the active section valid if the page list shrinks
  useEffect(() => {
    setSection((s) => Math.min(s, Math.max(0, sectionCount(total) - 1)));
  }, [total]);

  const [start, end] = sectionRange(Math.min(section, Math.max(0, nSections - 1)), total);
  const posStart = start - 1;
  const slice = sectioned ? pages.slice(posStart, end) : pages;

  const [thumbs, setThumbs] = useState<ThumbSet | null>(null);
  const [rendered, setRendered] = useState<Record<string, string | null>>({});
  const renderedRef = useRef<Record<string, string | null>>({});
  const queuedRef = useRef<Set<string>>(new Set());
  const liveRef = useRef<ThumbSet | null>(null);
  const [visible, setVisible] = useState<Set<number>>(new Set()); // absolute positions
  const [drawing, setDrawing] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const dragIndex = useRef<number | null>(null); // absolute position being dragged
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // (Re)create the lazy renderer when the PDF sources change; destroy on cleanup.
  useEffect(() => {
    const t = new ThumbSet(stableSources, width);
    renderedRef.current = {};
    queuedRef.current = new Set();
    setRendered({});
    setDrawing(0);
    liveRef.current = t;
    setThumbs(t);
    return () => {
      liveRef.current = null;
      t.destroy();
    };
  }, [stableSources, width]);

  // A new viewing window: off-screen positions of the old section are irrelevant.
  useEffect(() => {
    setVisible(new Set());
  }, [section]);

  // Observe cells of the ACTIVE SECTION only, so off-window pages never render.
  useEffect(() => {
    const root = gridRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        setVisible((cur) => {
          let changed = false;
          const next = new Set(cur);
          for (const e of entries) {
            if (e.isIntersecting) {
              const i = Number((e.target as HTMLElement).dataset.pos);
              if (!Number.isNaN(i) && !next.has(i)) {
                next.add(i);
                changed = true;
              }
            }
          }
          return changed ? next : cur;
        });
      },
      { rootMargin: '600px 0px' },
    );
    root.querySelectorAll('[data-pos]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [slice.length, section, thumbs]);

  // Queue eager + visible pages of the active section, one render at a time.
  useEffect(() => {
    if (!thumbs) return;
    const todo: number[] = [];
    slice.forEach((p, j) => {
      const pos = posStart + j;
      const k = pageKey(p);
      if ((j < eager || visible.has(pos)) && !(k in renderedRef.current) && !queuedRef.current.has(k)) todo.push(pos);
    });
    if (!todo.length) return;
    for (const pos of todo) queuedRef.current.add(pageKey(pages[pos]));
    setDrawing((d) => d + todo.length);
    const mine = thumbs;
    void (async () => {
      for (const pos of todo) {
        const p = pages[pos];
        if (!p) {
          setDrawing((d) => Math.max(0, d - 1));
          continue;
        }
        const url = await mine.render(p.file, p.src);
        if (liveRef.current !== mine) return; // renderer was replaced — discard
        renderedRef.current = { ...renderedRef.current, [pageKey(p)]: url };
        setRendered(renderedRef.current);
        setDrawing((d) => Math.max(0, d - 1));
      }
    })();
  }, [thumbs, pages, slice, posStart, visible, eager]);

  // After a section switch / page jump: scroll the requested page into view.
  useEffect(() => {
    if (focusPos === null) return;
    const el = gridRef.current?.querySelector(`[data-pos="${focusPos}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.focus({ preventScroll: true });
    el.classList.add('jump-flash');
    const t = setTimeout(() => el.classList.remove('jump-flash'), 1400);
    setFocusPos(null);
    return () => clearTimeout(t);
  }, [focusPos, section, slice.length]);

  const goToSection = (s: number) => {
    setSection(Math.min(Math.max(0, s), nSections - 1));
  };

  const jump = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(jumpVal);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > total) {
      setJumpErr(`Enter a page between 1 and ${total}.`);
      return;
    }
    setJumpErr(null);
    setSection(sectionForPage(n));
    setFocusPos(n - 1);
    setJumpVal('');
  };

  const toggleSel = (p: GridPage) => {
    if (!onSelectChange) return;
    const k = pageKey(p);
    const next = new Set(selected ?? []);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onSelectChange(next);
  };

  const rotatePage = (pos: number, deg: number) => {
    if (!onPagesChange) return;
    onPagesChange(pages.map((p, j) => (j === pos ? { ...p, rotate: (((p.rotate + deg) % 360) + 360) % 360 } : p)));
  };

  const deletePage = (pos: number) => {
    if (!onPagesChange) return;
    onPagesChange(pages.filter((_, j) => j !== pos));
    onSelectChange?.(new Set());
  };

  const move = (from: number, to: number) => {
    if (!onPagesChange || to < 0 || to >= total || from === to) return;
    const next = [...pages];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onPagesChange(next);
    onSelectChange?.(new Set());
  };

  const drawn = Object.keys(rendered).length;
  const selCount = selected?.size ?? 0;

  return (
    <div>
      {sectioned && (
        <div className="flex flex-wrap items-center gap-2 mb-3 bg-white/70 rounded-xl px-3 py-2 border-2 border-dashed border-[rgba(18,49,92,.25)]">
          <button
            type="button"
            className="icon-btn"
            style={{ width: 34, height: 34 }}
            aria-label="Previous 100 pages"
            title="Previous section"
            disabled={section === 0 || disabled}
            onClick={() => goToSection(section - 1)}
          >
            ‹
          </button>
          <span className="font-display font-bold">
            Section {section + 1} of {nSections}
          </span>
          <span className="font-hand text-sm text-[var(--ink-soft)]">
            Pages {start}–{end} of {total}
          </span>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 34, height: 34 }}
            aria-label="Next 100 pages"
            title="Next section"
            disabled={section >= nSections - 1 || disabled}
            onClick={() => goToSection(section + 1)}
          >
            ›
          </button>
          <span className="flex-1" />
          {selCount > 0 && (
            <span className="font-hand text-sm text-[var(--orange)] font-bold" title="Selection is kept across all sections">
              {selCount} selected (all sections)
            </span>
          )}
          <form className="flex items-center gap-1.5" onSubmit={jump}>
            <label className="font-hand text-sm text-[var(--ink-soft)]" htmlFor={`jump-${width}-${total}`}>
              Go to page
            </label>
            <input
              id={`jump-${width}-${total}`}
              className="jump-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={total}
              value={jumpVal}
              onChange={(e) => setJumpVal(e.target.value)}
              disabled={disabled}
            />
            <button type="submit" className="btn btn-white btn-sm" disabled={disabled}>
              Go
            </button>
          </form>
        </div>
      )}
      {jumpErr && <p className="font-hand text-[#c23a2b] text-sm mb-2">❌ {jumpErr}</p>}
      {drawing > 0 && (
        <div className="mb-3 max-w-sm">
          <ProgressBar percent={Math.round((drawn / Math.max(1, drawn + drawing)) * 100)} label="Drawing thumbnails…" blue />
        </div>
      )}
      <div
        ref={gridRef}
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 ${disabled ? 'opacity-60' : ''}`}
      >
        {slice.map((p, j) => {
          const pos = posStart + j;
          const k = pageKey(p);
          const url = rendered[k];
          const sub = subLabel?.(p, pos) ?? null;
          return (
            <div
              key={`${k}-${pos}`}
              data-pos={pos}
              data-src={p.src}
              tabIndex={-1}
              className={`thumb ${selected?.has(k) ? 'selected' : ''} ${overIndex === pos ? 'drop-target' : ''}`}
              draggable={reorderable && !disabled}
              {...(reorderable
                ? {
                    onDragStart: () => (dragIndex.current = pos),
                    onDragOver: (e: React.DragEvent) => {
                      e.preventDefault();
                      setOverIndex(pos);
                    },
                    onDragLeave: () => setOverIndex((o) => (o === pos ? null : o)),
                    onDrop: (e: React.DragEvent) => {
                      e.preventDefault();
                      if (dragIndex.current !== null) move(dragIndex.current, pos);
                      dragIndex.current = null;
                      setOverIndex(null);
                    },
                    onDragEnd: () => setOverIndex(null),
                  }
                : {})}
            >
              <div
                className="relative cursor-zoom-in"
                title="Click to enlarge"
                onClick={(e) => {
                  if (disabled) return;
                  if ((e.target as HTMLElement).closest('button,label')) return; // controls handle themselves
                  setZoom(pos);
                }}
              >
                {url ? (
                  <img
                    src={url}
                    alt={`Page ${pos + 1}`}
                    loading="lazy"
                    style={{ transform: p.rotate ? `rotate(${p.rotate}deg)` : undefined, transition: 'transform .18s' }}
                  />
                ) : url === null ? (
                  <div className="w-full aspect-[1/1.414] bg-[rgba(18,49,92,.06)] rounded flex flex-col items-center justify-center gap-1 text-center px-2">
                    <span style={{ fontSize: 26 }}>📄</span>
                    <span className="font-hand text-xs text-[var(--ink-soft)]">Preview unavailable</span>
                  </div>
                ) : (
                  <div className="w-full aspect-[1/1.414] bg-[rgba(18,49,92,.08)] animate-pulse rounded" />
                )}
                {url && overlay ? overlay(p, pos) : null}
                {selectable && (
                  <label className="chk absolute top-1.5 left-1.5 bg-white/95 rounded-lg p-1 shadow" title="Select page">
                    <input type="checkbox" checked={!!selected?.has(k)} onChange={() => toggleSel(p)} disabled={disabled} />
                    <span className="box" style={{ width: 20, height: 20 }} />
                  </label>
                )}
                {(rotatable || deletable) && !disabled && (
                  <span className="absolute top-1.5 right-1.5 flex gap-1">
                    {rotatable && (
                      <>
                        <button
                          className="icon-btn"
                          style={{ width: 30, height: 30 }}
                          title="Rotate page counter-clockwise"
                          aria-label={`Rotate page ${pos + 1} left`}
                          onClick={() => rotatePage(pos, -90)}
                        >
                          <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}>
                            <RotateIcon size={15} />
                          </span>
                        </button>
                        <button
                          className="icon-btn"
                          style={{ width: 30, height: 30 }}
                          title="Rotate page 90°"
                          aria-label={`Rotate page ${pos + 1}`}
                          onClick={() => rotatePage(pos, 90)}
                        >
                          <RotateIcon size={15} />
                        </button>
                      </>
                    )}
                    {deletable && (
                      <button
                        className="icon-btn"
                        style={{ width: 30, height: 30, color: '#c23a2b' }}
                        title="Delete page"
                        aria-label={`Delete page ${pos + 1}`}
                        onClick={() => deletePage(pos)}
                      >
                        <TrashIcon size={15} />
                      </button>
                    )}
                  </span>
                )}
                {reorderable && !disabled && (
                  <>
                    <span className="absolute bottom-1.5 left-1.5 cursor-grab bg-white/90 rounded-md p-0.5" title="Drag to reorder">
                      <GripIcon size={16} color="#5c6f92" />
                    </span>
                    <span className="absolute bottom-1.5 right-1.5 flex gap-1">
                      <button
                        className="icon-btn"
                        style={{ width: 28, height: 28 }}
                        title="Move earlier (works across sections)"
                        aria-label={`Move page ${pos + 1} left`}
                        disabled={pos === 0}
                        onClick={() => move(pos, pos - 1)}
                      >
                        ←
                      </button>
                      <button
                        className="icon-btn"
                        style={{ width: 28, height: 28 }}
                        title="Move later (works across sections)"
                        aria-label={`Move page ${pos + 1} right`}
                        disabled={pos === total - 1}
                        onClick={() => move(pos, pos + 1)}
                      >
                        →
                      </button>
                    </span>
                  </>
                )}
              </div>
              <p className="font-display font-bold text-center text-sm py-1 bg-[var(--paper-dim)]">
                Page {pos + 1}
                {p.rotate ? <span className="text-[var(--orange)]"> ↻{p.rotate}°</span> : null}
                {sub ? (
                  <span className="block font-hand text-[11px] font-normal text-[var(--ink-soft)] truncate px-1" title={sub}>
                    {sub}
                  </span>
                ) : null}
              </p>
            </div>
          );
        })}
      </div>
      {zoom !== null && pages[zoom] && (
        <PagePreviewModal sources={stableSources} pages={pages} index={zoom} onIndex={setZoom} onClose={() => setZoom(null)} />
      )}
    </div>
  );
}

export { SECTION_SIZE };
